"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, Clock } from "lucide-react"
import { format, addDays, isBefore, isAfter } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { supabase } from "@/utils/supabase/client"

type MaintenanceSchedule = {
  id: string
  tool_id: string
  tool_name: string
  serial_number: string
  scheduled_date: string
  maintenance_type: "Routine" | "Repair" | "Inspection"
  notes: string
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled"
}

type Tool = {
  id: string
  name: string
  serial_numbers: string[]
}

export function MaintenanceScheduler() {
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState<string>("")
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>("")
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined)
  const [maintenanceType, setMaintenanceType] = useState<"Routine" | "Repair" | "Inspection">("Routine")
  const [notes, setNotes] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

  // Fetch maintenance schedules and tools from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch maintenance schedules
        const { data: schedulesData, error: schedulesError } = await supabase
          .from("maintenance_schedules")
          .select(`
            id,
            tool_id,
            scheduled_date,
            maintenance_type,
            notes,
            status,
            tools (
              id,
              name
            ),
            tool_serial_numbers (
              id,
              serial_number
            )
          `)
          .order("scheduled_date", { ascending: true })

        if (schedulesError) throw schedulesError

        // Transform the data to match our component's expected format
        const formattedSchedules = schedulesData.map((schedule: any) => ({
          id: schedule.id,
          tool_id: schedule.tool_id,
          tool_name: schedule.tools?.name || "Unknown Tool",
          serial_number: schedule.tool_serial_numbers?.serial_number || "Unknown",
          scheduled_date: schedule.scheduled_date,
          maintenance_type: schedule.maintenance_type,
          notes: schedule.notes || "",
          status: schedule.status,
        }))

        setMaintenanceSchedules(formattedSchedules)

        // Fetch tools for the dropdown
        const { data: toolsData, error: toolsError } = await supabase
          .from("tools")
          .select(`
            id,
            name,
            tool_serial_numbers (
              serial_number
            )
          `)
          .order("name")

        if (toolsError) throw toolsError

        // Transform the tools data
        const formattedTools = toolsData.map((tool: any) => ({
          id: tool.id,
          name: tool.name,
          serial_numbers: tool.tool_serial_numbers.map((sn: any) => sn.serial_number),
        }))

        setTools(formattedTools)
      } catch (error) {
        console.error("Error fetching maintenance data:", error)
        toast({
          title: "Error",
          description: "Failed to load maintenance schedules",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleScheduleMaintenance = async () => {
    if (!selectedTool || !selectedSerialNumber || !scheduledDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      // Get the serial number ID
      const { data: serialNumberData, error: serialNumberError } = await supabase
        .from("tool_serial_numbers")
        .select("id")
        .eq("tool_id", selectedTool)
        .eq("serial_number", selectedSerialNumber)
        .single()

      if (serialNumberError) throw serialNumberError

      // Create the maintenance schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from("maintenance_schedules")
        .insert({
          tool_id: selectedTool,
          serial_number_id: serialNumberData.id,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          maintenance_type: maintenanceType,
          notes: notes,
          status: "Scheduled",
        })
        .select()

      if (scheduleError) throw scheduleError

      // If maintenance type is Repair, update the tool status to Under Maintenance
      if (maintenanceType === "Repair") {
        const { error: updateError } = await supabase
          .from("tool_serial_numbers")
          .update({ status: "Under Maintenance" })
          .eq("id", serialNumberData.id)

        if (updateError) throw updateError
      }

      // Refresh the maintenance schedules
      const { data: refreshedData, error: refreshError } = await supabase
        .from("maintenance_schedules")
        .select(`
          id,
          tool_id,
          scheduled_date,
          maintenance_type,
          notes,
          status,
          tools (
            id,
            name
          ),
          tool_serial_numbers (
            id,
            serial_number
          )
        `)
        .order("scheduled_date", { ascending: true })

      if (refreshError) throw refreshError

      // Transform the refreshed data
      const formattedSchedules = refreshedData.map((schedule: any) => ({
        id: schedule.id,
        tool_id: schedule.tool_id,
        tool_name: schedule.tools?.name || "Unknown Tool",
        serial_number: schedule.tool_serial_numbers?.serial_number || "Unknown",
        scheduled_date: schedule.scheduled_date,
        maintenance_type: schedule.maintenance_type,
        notes: schedule.notes || "",
        status: schedule.status,
      }))

      setMaintenanceSchedules(formattedSchedules)

      // Reset form
      setSelectedTool("")
      setSelectedSerialNumber("")
      setScheduledDate(undefined)
      setMaintenanceType("Routine")
      setNotes("")

      toast({
        title: "Success",
        description: "Maintenance scheduled successfully",
      })
    } catch (error) {
      console.error("Error scheduling maintenance:", error)
      toast({
        title: "Error",
        description: "Failed to schedule maintenance",
        variant: "destructive",
      })
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: "Scheduled" | "In Progress" | "Completed" | "Cancelled") => {
    try {
      // Update the maintenance schedule status
      const { error: updateError } = await supabase
        .from("maintenance_schedules")
        .update({ status: newStatus })
        .eq("id", id)

      if (updateError) throw updateError

      // Get the updated maintenance schedule
      const { data: updatedSchedule, error: fetchError } = await supabase
        .from("maintenance_schedules")
        .select(`
          id,
          tool_id,
          serial_number_id
        `)
        .eq("id", id)
        .single()

      if (fetchError) throw fetchError

      // If maintenance is completed, update the tool status
      if (newStatus === "Completed") {
        const { error: serialUpdateError } = await supabase
          .from("tool_serial_numbers")
          .update({
            status: "Available",
          })
          .eq("id", updatedSchedule.serial_number_id)

        if (serialUpdateError) throw serialUpdateError

        // Update the tool's last_maintenance date
        const { error: toolUpdateError } = await supabase
          .from("tools")
          .update({
            last_maintenance: new Date().toISOString().split("T")[0],
          })
          .eq("id", updatedSchedule.tool_id)

        if (toolUpdateError) throw toolUpdateError
      }

      // Refresh the maintenance schedules
      const { data: refreshedData, error: refreshError } = await supabase
        .from("maintenance_schedules")
        .select(`
          id,
          tool_id,
          scheduled_date,
          maintenance_type,
          notes,
          status,
          tools (
            id,
            name
          ),
          tool_serial_numbers (
            id,
            serial_number
          )
        `)
        .order("scheduled_date", { ascending: true })

      if (refreshError) throw refreshError

      // Transform the refreshed data
      const formattedSchedules = refreshedData.map((schedule: any) => ({
        id: schedule.id,
        tool_id: schedule.tool_id,
        tool_name: schedule.tools?.name || "Unknown Tool", 
        serial_number: schedule.tool_serial_numbers?.serial_number || "Unknown",
        scheduled_date: schedule.scheduled_date,
        maintenance_type: schedule.maintenance_type,
        notes: schedule.notes || "",
        status: schedule.status,
      }))

      setMaintenanceSchedules(formattedSchedules)

      toast({
        title: "Status Updated",
        description: `Maintenance status updated to ${newStatus}`,
      })
    } catch (error) {
      console.error("Error updating maintenance status:", error)
      toast({
        title: "Error",
        description: "Failed to update maintenance status",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100/80"
      case "In Progress":
        return "bg-amber-100 text-amber-800 hover:bg-amber-100/80"
      case "Completed":
        return "bg-green-100 text-green-800 hover:bg-green-100/80"
      case "Cancelled":
        return "bg-red-100 text-red-800 hover:bg-red-100/80"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100/80"
    }
  }

  const getMaintenanceTypeColor = (type: string) => {
    switch (type) {
      case "Routine":
        return "bg-blue-100 text-blue-800"
      case "Repair":
        return "bg-red-100 text-red-800"
      case "Inspection":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy")
  }

  // Filter maintenance schedules based on status and date
  const filteredSchedules = maintenanceSchedules.filter((schedule) => {
    const matchesStatus = statusFilter === "all" || schedule.status === statusFilter

    let matchesDate = true
    const scheduleDate = new Date(schedule.scheduled_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (dateFilter === "upcoming") {
      matchesDate = isAfter(scheduleDate, today)
    } else if (dateFilter === "past") {
      matchesDate = isBefore(scheduleDate, today)
    } else if (dateFilter === "today") {
      matchesDate = format(scheduleDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
    } else if (dateFilter === "week") {
      const nextWeek = addDays(today, 7)
      matchesDate = isAfter(scheduleDate, today) && isBefore(scheduleDate, nextWeek)
    }

    return matchesStatus && matchesDate
  })

  // Get available serial numbers for selected tool
  const availableSerialNumbers = selectedTool
    ? tools.find((tool) => tool.id === selectedTool)?.serial_numbers || []
    : []

  // Calculate summary counts
  const scheduledCount = maintenanceSchedules.filter((s) => s.status === "Scheduled").length
  const inProgressCount = maintenanceSchedules.filter((s) => s.status === "In Progress").length
  const completedCount = maintenanceSchedules.filter((s) => s.status === "Completed").length
  const cancelledCount = maintenanceSchedules.filter((s) => s.status === "Cancelled").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Schedule Maintenance</CardTitle>
            <CardDescription>Schedule routine or repair maintenance for tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tool</label>
              <Select
                value={selectedTool}
                onValueChange={(value) => {
                  setSelectedTool(value)
                  setSelectedSerialNumber("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool: any) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Serial Number</label>
              <Select
                value={selectedSerialNumber}
                onValueChange={setSelectedSerialNumber}
                disabled={!selectedTool || availableSerialNumbers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select serial number" />
                </SelectTrigger>
                <SelectContent>
                  {availableSerialNumbers.map((serialNumber: any) => (
                    <SelectItem key={serialNumber} value={serialNumber}>
                      {serialNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Maintenance Type</label>
              <Select
                value={maintenanceType}
                onValueChange={(value) => setMaintenanceType(value as "Routine" | "Repair" | "Inspection")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select maintenance type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Repair">Repair</SelectItem>
                  <SelectItem value="Inspection">Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="w-full min-h-[80px] p-2 border rounded-md"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter maintenance details or instructions"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleScheduleMaintenance}
              disabled={!selectedTool || !selectedSerialNumber || !scheduledDate}
            >
              Schedule Maintenance
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Maintenance Overview</CardTitle>
            <CardDescription>Summary of scheduled and completed maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-blue-700">{scheduledCount}</div>
                <div className="text-sm text-blue-600">Scheduled</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-amber-700">{inProgressCount}</div>
                <div className="text-sm text-amber-600">In Progress</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-green-700">{completedCount}</div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-red-700">{cancelledCount}</div>
                <div className="text-sm text-red-600">Cancelled</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Upcoming Maintenance</h3>
              <div className="space-y-2">
                {maintenanceSchedules
                  .filter((s) => s.status === "Scheduled" && new Date(s.scheduled_date) >= new Date())
                  .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                  .slice(0, 3)
                  .map((schedule: any) => (
                    <div key={schedule.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <div className="font-medium">{schedule.tool_name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(schedule.scheduled_date)}</div>
                      </div>
                      <Badge className={getMaintenanceTypeColor(schedule.maintenance_type)}>
                        {schedule.maintenance_type}
                      </Badge>
                    </div>
                  ))}
                {maintenanceSchedules.filter(
                  (s) => s.status === "Scheduled" && new Date(s.scheduled_date) >= new Date(),
                ).length === 0 && (
                  <div className="text-sm text-muted-foreground">No upcoming maintenance scheduled</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Schedule</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Next 7 Days</SelectItem>
                <SelectItem value="upcoming">All Upcoming</SelectItem>
                <SelectItem value="past">Past Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <div className="flex justify-center">
                      <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mt-2">Loading maintenance schedules...</p>
                  </TableCell>
                </TableRow>
              ) : filteredSchedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <p className="text-muted-foreground">No maintenance schedules found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchedules.map((schedule: any) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.tool_name}</TableCell>
                    <TableCell>{schedule.serial_number}</TableCell>
                    <TableCell>{formatDate(schedule.scheduled_date)}</TableCell>
                    <TableCell>
                      <Badge className={getMaintenanceTypeColor(schedule.maintenance_type)}>
                        {schedule.maintenance_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(schedule.status)}>{schedule.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={schedule.notes}>
                      {schedule.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        defaultValue="actions"
                        onValueChange={(value) => {
                          if (value !== "actions") {
                            handleUpdateStatus(schedule.id, value as any)
                          }
                        }}
                        disabled={schedule.status === "Completed" || schedule.status === "Cancelled"}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue placeholder="Actions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="actions" disabled>
                            Update Status
                          </SelectItem>
                          <SelectItem value="Scheduled" disabled={schedule.status === "Scheduled"}>
                            Mark as Scheduled
                          </SelectItem>
                          <SelectItem value="In Progress" disabled={schedule.status === "In Progress"}>
                            Mark as In Progress
                          </SelectItem>
                          <SelectItem value="Completed" disabled={schedule.status === "Completed"}>
                            Mark as Completed
                          </SelectItem>
                          <SelectItem value="Cancelled" disabled={schedule.status === "Cancelled"}>
                            Mark as Cancelled
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

