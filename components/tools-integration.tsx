"use client"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/utils/supabase/client"

// This component provides integration between the Tools Record Table and the Maintenance Scheduler

export function useToolsIntegration() {
  // Update tool status when maintenance is scheduled or completed
  const updateToolMaintenanceStatus = async (
    toolId: string,
    serialNumber: string,
    status: "Available" | "Not Available" | "Under Maintenance",
    maintenanceDate?: string,
  ) => {
    try {
      // Find the serial number ID
      const { data: serialNumberData, error: serialNumberError } = await supabase
        .from("tool_serial_numbers")
        .select("id")
        .eq("serial_number", serialNumber)
        .single()

      if (serialNumberError) throw serialNumberError

      // Update the tool_serial_numbers table
      const { error: serialError } = await supabase
        .from("tool_serial_numbers")
        .update({ status: status })
        .eq("id", serialNumberData.id)

      if (serialError) throw serialError

      // Update the tools table last_maintenance date if provided
      if (maintenanceDate) {
        const { error: toolError } = await supabase
          .from("tools")
          .update({
            last_maintenance: maintenanceDate,
          })
          .eq("id", toolId)

        if (toolError) throw toolError
      }

      // Check if all serial numbers for this tool have the same status
      const { data: serialNumbers, error: fetchError } = await supabase
        .from("tool_serial_numbers")
        .select("status")
        .eq("tool_id", toolId)

      if (fetchError) throw fetchError

      // If all serial numbers have the same status, update the tool status
      const allSameStatus = serialNumbers.every((sn) => sn.status === status)
      if (allSameStatus) {
        const { error: toolUpdateError } = await supabase.from("tools").update({ status: status }).eq("id", toolId)

        if (toolUpdateError) throw toolUpdateError
      }

      toast({
        title: "Tool Status Updated",
        description: `Tool ${serialNumber} is now ${status}`,
      })

      return true
    } catch (error) {
      console.error("Error updating tool status:", error)
      toast({
        title: "Error",
        description: "Failed to update tool status",
        variant: "destructive",
      })

      return false
    }
  }

  // Check if a tool is available for assignment to a project
  const checkToolAvailability = async (serialNumber: string) => {
    try {
      const { data, error } = await supabase
        .from("tool_serial_numbers")
        .select("status, tools(id, name)")
        .eq("serial_number", serialNumber)
        .single()

      if (error) throw error

      return {
        available: data.status === "Available",
        status: data.status,
        toolId: data.tools[0].id,
        toolName: data.tools[0].name,
      }
    } catch (error) {
      console.error("Error checking tool availability:", error)
      return {
        available: false,
        status: "Error",
        toolId: null,
        toolName: null,
      }
    }
  }

  // Get upcoming maintenance for a specific tool
  const getToolMaintenanceSchedule = async (toolId: string, serialNumber?: string) => {
    try {
      // First, if we have a serial number, get its ID
      let serialNumberId = null
      if (serialNumber) {
        const { data: serialData, error: serialError } = await supabase
          .from("tool_serial_numbers")
          .select("id")
          .eq("serial_number", serialNumber)
          .single()

        if (serialError) throw serialError
        serialNumberId = serialData.id
      }

      // Build the query
      let query = supabase
        .from("maintenance_schedules")
        .select(`
          id,
          scheduled_date,
          maintenance_type,
          notes,
          status,
          tool_serial_numbers(id, serial_number)
        `)
        .eq("tool_id", toolId)
        .in("status", ["Scheduled", "In Progress"])
        .order("scheduled_date", { ascending: true })

      // Add serial number filter if provided
      if (serialNumberId) {
        query = query.eq("serial_number_id", serialNumberId)
      }

      const { data, error } = await query

      if (error) throw error

      return data.map((schedule: any) => ({
        id: schedule.id,
        scheduledDate: schedule.scheduled_date,
        maintenanceType: schedule.maintenance_type,
        notes: schedule.notes,
        status: schedule.status,
        serialNumber: (schedule.tool_serial_numbers as any).serial_number,
      }))
    } catch (error) {
      console.error("Error fetching maintenance schedule:", error)
      return []
    }
  }

  // Schedule maintenance for a tool
  const scheduleToolMaintenance = async (
    toolId: string,
    serialNumber: string,
    maintenanceType: string,
    scheduledDate: string,
    notes = "",
  ) => {
    try {
      // Get the serial number ID
      const { data: serialNumberData, error: serialNumberError } = await supabase
        .from("tool_serial_numbers")
        .select("id")
        .eq("serial_number", serialNumber)
        .single()

      if (serialNumberError) throw serialNumberError

      // Create the maintenance schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("maintenance_schedules")
        .insert({
          tool_id: toolId,
          serial_number_id: serialNumberData.id,
          scheduled_date: scheduledDate,
          maintenance_type: maintenanceType,
          notes: notes,
          status: "Scheduled",
        })
        .select()
        .single()

      if (scheduleError) throw scheduleError

      // If maintenance type is Repair, update the tool status to Under Maintenance
      if (maintenanceType === "Repair") {
        const { error: updateError } = await supabase
          .from("tool_serial_numbers")
          .update({ status: "Under Maintenance" })
          .eq("id", serialNumberData.id)

        if (updateError) throw updateError

        // Check if all serial numbers for this tool are under maintenance
        const { data: serialNumbers, error: fetchError } = await supabase
          .from("tool_serial_numbers")
          .select("status")
          .eq("tool_id", toolId)

        if (fetchError) throw fetchError

        const allUnderMaintenance = serialNumbers.every((sn) => sn.status === "Under Maintenance")

        if (allUnderMaintenance) {
          const { error: toolUpdateError } = await supabase
            .from("tools")
            .update({ status: "Under Maintenance" })
            .eq("id", toolId)

          if (toolUpdateError) throw toolUpdateError
        }
      }

      return {
        success: true,
        schedule: schedule,
      }
    } catch (error) {
      console.error("Error scheduling maintenance:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to schedule maintenance",
      }
    }
  }

  // Complete maintenance for a tool
  const completeToolMaintenance = async (maintenanceId: string) => {
    try {
      // Get the current maintenance schedule
      const { data: currentSchedule, error: fetchError } = await supabase
        .from("maintenance_schedules")
        .select(`
          *,
          tool_serial_numbers(id, serial_number, status, tool_id)
        `)
        .eq("id", maintenanceId)
        .single()

      if (fetchError) throw fetchError

      // Update the maintenance schedule
      const { error: scheduleError } = await supabase
        .from("maintenance_schedules")
        .update({ status: "Completed" })
        .eq("id", maintenanceId)

      if (scheduleError) throw scheduleError

      // Update the serial number status
      const { error: serialNumberError } = await supabase
        .from("tool_serial_numbers")
        .update({
          status: "Available",
        })
        .eq("id", currentSchedule.serial_number_id)

      if (serialNumberError) throw serialNumberError

      // Update the tool's last_maintenance date
      const { error: toolError } = await supabase
        .from("tools")
        .update({
          last_maintenance: new Date().toISOString().split("T")[0],
        })
        .eq("id", currentSchedule.tool_serial_numbers.tool_id)

      if (toolError) throw toolError

      // Check if all serial numbers for this tool are now available
      const { data: serialNumbers, error: fetchSerialError } = await supabase
        .from("tool_serial_numbers")
        .select("status")
        .eq("tool_id", currentSchedule.tool_serial_numbers.tool_id)

      if (fetchSerialError) throw fetchSerialError

      const allAvailable = serialNumbers.every((sn) => sn.status === "Available")

      if (allAvailable) {
        const { error: toolStatusError } = await supabase
          .from("tools")
          .update({ status: "Available" })
          .eq("id", currentSchedule.tool_serial_numbers.tool_id)

        if (toolStatusError) throw toolStatusError
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error("Error completing maintenance:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete maintenance",
      }
    }
  }

  return {
    updateToolMaintenanceStatus,
    checkToolAvailability,
    getToolMaintenanceSchedule,
    scheduleToolMaintenance,
    completeToolMaintenance,
  }
}

