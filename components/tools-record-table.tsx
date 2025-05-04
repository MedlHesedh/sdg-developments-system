"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  QrCode,
  Edit,
  AlertTriangle,
  RefreshCw,
  CircleCheckBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { QRCodeGenerator } from "@/components/qr-code-generator";
import { supabase } from "@/utils/supabase/client";
import { z } from "zod";

const toolSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  status: z.enum(["Available", "Not Available", "Under Maintenance"]),
  condition_notes: z.string().optional(),
  last_maintenance: z.string().min(1, "Last maintenance date is required"),
});

type NewToolInput = z.infer<typeof toolSchema>;

type Tool = {
  id: string;
  name: string;
  quantity: number;
  status: "Available" | "Not Available" | "Under Maintenance";
  condition_notes: string;
  last_maintenance: string;
  serial_numbers: string[];
};

const initialNewTool: NewToolInput = {
  name: "",
  quantity: 1,
  status: "Available",
  condition_notes: "",
  last_maintenance: new Date().toISOString().split("T")[0],
};

export function ToolsRecordTable() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [isEditingTool, setIsEditingTool] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newTool, setNewTool] = useState<NewToolInput>(initialNewTool);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({
    type: null,
    message: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [showSerialListDialog, setShowSerialListDialog] = useState(false);
  const [serialListTool, setSerialListTool] = useState<Tool | null>(null);

  // Auto-dismiss alerts after 5 seconds
  useEffect(() => {
    if (alert.type) {
      const timer = setTimeout(() => {
        setAlert({ type: null, message: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("tools")
          .select(`*, tool_serial_numbers(*)`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const formattedTools = data.map((tool: any) => ({
          id: tool.id,
          name: tool.name,
          quantity: tool.quantity,
          status: tool.status,
          condition_notes: tool.condition_notes || "",
          last_maintenance: tool.last_maintenance,
          serial_numbers: tool.tool_serial_numbers.map(
            (sn: any) => sn.serial_number
          ),
        }));
        setTools(formattedTools);
      } catch (error) {
        console.error("Error fetching tools:", error);
        toast({
          title: "Error",
          description: "Failed to load tools inventory",
          variant: "destructive",
        });
        setTools([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, []);

  function generateRandom3Chars(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function generateSerialNumbers(name: string, quantity: number): string[] {
    const prefix = name.trim().substring(0, 3).toUpperCase();
    const randomPart = generateRandom3Chars();
    const serials: string[] = [];
    for (let i = 1; i <= quantity; i++) {
      const numberPart = i.toString().padStart(3, "0");
      serials.push(`${prefix}${randomPart}-${numberPart}`);
    }
    return serials;
  }

  const handleAddTool = async () => {
    const parseResult = toolSchema.safeParse(newTool);
    if (!parseResult.success) {
      const errors = parseResult.error.issues
        .map((issue) => issue.message)
        .join(", ");
      setAlert({ type: "error", message: errors });
      return;
    }
    setIsSubmitting(true);
    try {
      const serialNumbers = generateSerialNumbers(
        newTool.name,
        newTool.quantity
      );
      const { data: toolData, error: toolError } = await supabase
        .from("tools")
        .insert({
          name: newTool.name,
          quantity: newTool.quantity,
          status: newTool.status,
          condition_notes: newTool.condition_notes,
          last_maintenance: newTool.last_maintenance,
        })
        .select();
      if (toolError) throw toolError;

      const toolId = toolData[0].id; // Get the ID of the newly inserted tool

      // Insert serial numbers with the correct tool_id
      const serialNumbersToInsert = serialNumbers.map((serialNumber) => ({
        tool_id: toolId, // Use the same tool_id for all serial numbers of this tool
        serial_number: serialNumber,
        status: newTool.status,
      }));

      const { error: serialNumberError } = await supabase
        .from("tool_serial_numbers")
        .insert(serialNumbersToInsert);
      if (serialNumberError) throw serialNumberError;

      // Refresh the tools list
      const { data: updatedTools, error: fetchError } = await supabase
        .from("tools")
        .select(`*, tool_serial_numbers(*)`)
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;

      const formattedTools = updatedTools.map((tool: any) => ({
        id: tool.id,
        name: tool.name,
        quantity: tool.quantity,
        status: tool.status,
        condition_notes: tool.condition_notes || "",
        last_maintenance: tool.last_maintenance,
        serial_numbers: tool.tool_serial_numbers.map(
          (sn: any) => sn.serial_number
        ),
      }));

      setTools(formattedTools);
      setNewTool(initialNewTool);
      setIsAddingTool(false);
      setAlert({ type: "success", message: "Tool added to inventory" });
    } catch (error: any) {
      console.error("Error adding tool:", error);
      setAlert({
        type: "error",
        message: error.message || "Failed to add tool to inventory",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTool = async () => {
    if (!selectedTool) return;
    try {
      // Get existing serial numbers from database
      const { data: existingSerialNumbers, error: fetchError } = await supabase
        .from("tool_serial_numbers")
        .select("id, serial_number")
        .eq("tool_id", selectedTool.id)
        .order("serial_number", { ascending: true });

      if (fetchError) throw fetchError;

      let updatedSerialNumbers = existingSerialNumbers.map((sn: any) => sn.serial_number);

      // Handle quantity changes
      if (selectedTool.quantity !== updatedSerialNumbers.length) {
        if (selectedTool.quantity > updatedSerialNumbers.length) {
          // Generate new serial numbers for increased quantity
          const additionalQuantity = selectedTool.quantity - updatedSerialNumbers.length;
          const lastSerial = updatedSerialNumbers[updatedSerialNumbers.length - 1];
          const [prefix, randomPart, lastNum] = lastSerial.split(/(...-)(\d+)/);
          let lastNumber = parseInt(lastNum, 10);

          for (let i = 1; i <= additionalQuantity; i++) {
            const numberPart = (lastNumber + i).toString().padStart(3, "0");
            updatedSerialNumbers.push(`${prefix}${randomPart}-${numberPart}`);
          }
        } else {
          // Decrease quantity by truncating the serial numbers list
          updatedSerialNumbers = updatedSerialNumbers.slice(0, selectedTool.quantity);
        }
      }

      // Update the tool in supabase
      const { error: toolError } = await supabase
        .from("tools")
        .update({
          name: selectedTool.name,
          quantity: selectedTool.quantity,
          status: selectedTool.status,
          condition_notes: selectedTool.condition_notes,
          last_maintenance: selectedTool.last_maintenance,
        })
        .eq("id", selectedTool.id);
      if (toolError) throw toolError;

      // Find differences between existing and updated serial numbers
      const existingMap = new Map(
        existingSerialNumbers.map((sn: any) => [sn.serial_number, sn.id])
      );

      // Find serial numbers to delete
      const toDelete = existingSerialNumbers
        .filter((existing: any) => !updatedSerialNumbers.includes(existing.serial_number))
        .map((sn: any) => sn.id);

      // Delete removed serial numbers
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("tool_serial_numbers")
          .delete()
          .in("id", toDelete);
        if (deleteError) throw deleteError;
      }

      // Find new serial numbers to add
      const newSerialNumbers = updatedSerialNumbers.filter(
        (sn) => !existingMap.has(sn)
      );

      // Add new serial numbers
      if (newSerialNumbers.length > 0) {
        const serialNumbersToInsert = newSerialNumbers.map((serialNumber) => ({
          tool_id: selectedTool.id,
          serial_number: serialNumber,
          status: selectedTool.status,
        }));
        const { error: insertError } = await supabase
          .from("tool_serial_numbers")
          .insert(serialNumbersToInsert);
        if (insertError) throw insertError;
      }

      // Update status of remaining serial numbers
      let query = supabase
        .from("tool_serial_numbers")
        .update({ status: selectedTool.status })
        .eq("tool_id", selectedTool.id);

      if (toDelete.length > 0) {
        query = query.not("id", "in", `(${toDelete.join(",")})`);
      }

      const { error: updateError } = await query;
      if (updateError) throw updateError;

      // Update UI state
      setTools(prevTools => prevTools.map(tool =>
        tool.id === selectedTool.id ?
          { ...selectedTool, serial_numbers: updatedSerialNumbers } :
          tool
      ));

      // Refresh from database
      const { data: updatedTools, error: refreshError } = await supabase
        .from("tools")
        .select(`*, tool_serial_numbers(*)`)
        .order("created_at", { ascending: false });
      if (refreshError) throw refreshError;

      const formattedTools = updatedTools.map((tool: any) => ({
        id: tool.id,
        name: tool.name,
        quantity: tool.quantity,
        status: tool.status,
        condition_notes: tool.condition_notes || "",
        last_maintenance: tool.last_maintenance,
        serial_numbers: tool.tool_serial_numbers.map((sn: any) => sn.serial_number),
      }));

      setTools(formattedTools);
      setIsEditingTool(false);
      toast({ title: "Success", description: "Tool information updated" });
    } catch (error) {
      console.error("Error updating tool:", error);
      toast({
        title: "Error",
        description: "Failed to update tool information",
        variant: "destructive",
      });
    }
  };

  const handleShowQRCode = (tool: Tool, serialNumber: string) => {
    // Create a new object to ensure React detects the state change
    setSelectedTool({ ...tool });
    setSelectedSerialNumber(serialNumber);
    setShowQRCode(true);
  };

  const handleEditTool = (tool: Tool) => {
    setSelectedTool(tool);
    setIsEditingTool(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800 hover:bg-green-100/80";
      case "Not Available":
        return "bg-amber-100 text-amber-800 hover:bg-amber-100/80";
      case "Under Maintenance":
        return "bg-red-100 text-red-800 hover:bg-red-100/80";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100/80";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.serial_numbers.some((sn) =>
        sn.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesStatus =
      statusFilter === "all" || tool.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTools.length / pageSize);
  const paginatedTools = filteredTools.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {alert.type === "success" && (
        <div className="absolute top-4 right-4 w-fit transition-opacity duration-300">
          <Alert variant="default" className="border-green-600 text-green-600">
            <CircleCheckBig className="h-4 w-4 stroke-green-600" />
            <div className="flex flex-col pr-10">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </div>
          </Alert>
        </div>
      )}
      {alert.type === "error" && (
        <div className="absolute top-4 right-4 w-fit transition-opacity duration-300">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex flex-col pr-10">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </div>
          </Alert>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search by tool name or serial number..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Available">Available</SelectItem>
              <SelectItem value="Not Available">Not Available</SelectItem>
              <SelectItem value="Under Maintenance">
                Under Maintenance
              </SelectItem>
            </SelectContent>
          </Select>
          <Sheet open={isAddingTool} onOpenChange={setIsAddingTool}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Tool
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Add New Tool</SheetTitle>
                <SheetDescription>
                  Add a new tool to your inventory
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label htmlFor="tool-name">Tool Name</Label>
                  <Input
                    id="tool-name"
                    value={newTool.name}
                    onChange={(e) =>
                      setNewTool({ ...newTool, name: e.target.value })
                    }
                    placeholder="e.g. Concrete Mixer, Power Drill"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-quantity">Quantity</Label>
                  <Input
                    id="tool-quantity"
                    type="number"
                    min="1"
                    value={newTool.quantity.toString()}
                    onChange={(e) => {
                      const quantity = Number.parseInt(e.target.value);
                      if (quantity < 1) return;
                      setNewTool({ ...newTool, quantity });
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-status">Status</Label>
                  <Select
                    value={newTool.status}
                    onValueChange={(value) =>
                      setNewTool({
                        ...newTool,
                        status: value as
                          | "Available"
                          | "Not Available"
                          | "Under Maintenance",
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="tool-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Not Available">
                        Not Available
                      </SelectItem>
                      <SelectItem value="Under Maintenance">
                        Under Maintenance
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* <div className="space-y-2">
                  <Label htmlFor="tool-maintenance">
                    Last Maintenance Date
                  </Label>
                  <Input
                    id="tool-maintenance"
                    type="date"
                    value={newTool.last_maintenance}
                    onChange={(e) =>
                      setNewTool({
                        ...newTool,
                        last_maintenance: e.target.value,
                      })
                    }
                    disabled={isSubmitting}
                  />
                </div> */}
                {newTool.status === "Under Maintenance" && (
                  <div className="space-y-2">
                    <Label htmlFor="tool-notes">Condition Notes</Label>
                    <Textarea
                      id="tool-notes"
                      value={newTool.condition_notes}
                      onChange={(e) =>
                        setNewTool({
                          ...newTool,
                          condition_notes: e.target.value,
                        })
                      }
                      placeholder="Describe the maintenance needs or issues"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingTool(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddTool} disabled={isSubmitting}>
                  {isSubmitting ? "Adding Tool..." : "Add Tool"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Tabs defaultValue="table" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="cards">Card View</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Tools Inventory</CardTitle>
              <CardDescription>
                Manage your construction tools inventory, status, and
                maintenance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    {/* <TableHead>Last Maintenance</TableHead> */}
                    <TableHead>Serial Numbers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <div className="flex justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground mt-2">
                          Loading tools inventory...
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <p className="text-muted-foreground">
                          No tools found matching your search criteria
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTools.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell className="font-medium">
                          {tool.name}
                        </TableCell>
                        <TableCell>{tool.quantity}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(tool.status)}>
                            {tool.status}
                          </Badge>
                        </TableCell>
                        {/* <TableCell>
                          {formatDate(tool.last_maintenance)}
                        </TableCell> */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tool.serial_numbers
                              .slice(0, 2)
                              .map((serialNumber) => (
                                <Badge
                                  key={serialNumber}
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    handleShowQRCode(tool, serialNumber)
                                  }
                                >
                                  <QrCode className="h-3 w-3 mr-1" />
                                  {serialNumber}
                                </Badge>
                              ))}
                            {tool.serial_numbers.length > 2 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSerialListTool(tool);
                                  setShowSerialListDialog(true);
                                }}
                              >
                                Show More
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTool(tool)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredTools.length > pageSize && (
                <div className="flex justify-end items-center space-x-4 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cards">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground mt-4">
                  Loading tools inventory...
                </p>
              </div>
            </div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                No tools found matching your search criteria
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTools.map((tool) => (
                <Card key={tool.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle>{tool.name}</CardTitle>
                      <Badge className={getStatusColor(tool.status)}>
                        {tool.status}
                      </Badge>
                    </div>
                    <CardDescription>Quantity: {tool.quantity}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium">Last Maintenance</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(tool.last_maintenance)}
                        </p>
                      </div>
                      {tool.condition_notes && (
                        <div>
                          <p className="text-sm font-medium flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
                            Condition Notes
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {tool.condition_notes}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium mb-1">
                          Serial Numbers
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tool.serial_numbers
                            .slice(0, 2)
                            .map((serialNumber) => (
                              <Badge
                                key={serialNumber}
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() =>
                                  handleShowQRCode(tool, serialNumber)
                                }
                              >
                                <QrCode className="h-3 w-3 mr-1" />
                                {serialNumber}
                              </Badge>
                            ))}
                          {tool.serial_numbers.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSerialListTool(tool);
                                setShowSerialListDialog(true);
                              }}
                            >
                              Show More
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleEditTool(tool)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Tool
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code for {selectedTool?.name}</DialogTitle>
            <DialogDescription>
              Serial Number: {selectedSerialNumber}
            </DialogDescription>
          </DialogHeader>
          <QRCodeGenerator
            serialNumber={selectedSerialNumber}
            toolName={selectedTool?.name || ""}
          />
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your phone's camera or a QR code scanner
              app to access this tool's details.
            </p>
          </div>
          <div className="text-center mt-4">
            <Button
              onClick={() => {
                if (selectedTool && selectedSerialNumber) {
                  // Include both tool ID and serial number in the URL
                  window.location.href = `/tools/${selectedTool.id}?sn=${selectedSerialNumber}`;
                }
              }}
            >
              Go to Tool Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showSerialListDialog}
        onOpenChange={setShowSerialListDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Serial Numbers for {serialListTool?.name}</DialogTitle>
            <DialogDescription>List of Serial Numbers:</DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {serialListTool?.serial_numbers.map((sn) => (
              <div
                key={sn}
                className="p-2 border rounded cursor-pointer hover:bg-gray-100"
                onClick={() => handleShowQRCode(serialListTool as Tool, sn)}
              >
                {sn}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isEditingTool} onOpenChange={setIsEditingTool}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Tool</SheetTitle>
            <SheetDescription>
              Update tool information and status
            </SheetDescription>
          </SheetHeader>
          {selectedTool && (
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tool-name">Tool Name</Label>
                <Input
                  id="edit-tool-name"
                  value={selectedTool.name}
                  onChange={(e) =>
                    setSelectedTool({ ...selectedTool, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tool-quantity">Quantity</Label>
                <Input
                  id="edit-tool-quantity"
                  type="number"
                  min="1"
                  value={selectedTool.quantity.toString()}
                  onChange={(e) => {
                    const quantity = Number.parseInt(e.target.value);
                    if (quantity < 1) return;
                    let serialNumbers = [...selectedTool.serial_numbers];
                    if (quantity < serialNumbers.length) {
                      serialNumbers = serialNumbers.slice(0, quantity);
                    }
                    setSelectedTool({
                      ...selectedTool,
                      quantity: quantity,
                      serial_numbers: serialNumbers,
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tool-status">Status</Label>
                <Select
                  value={selectedTool.status}
                  onValueChange={(value) =>
                    setSelectedTool({
                      ...selectedTool,
                      status: value as
                        | "Available"
                        | "Not Available"
                        | "Under Maintenance",
                    })
                  }
                >
                  <SelectTrigger id="edit-tool-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Not Available">Not Available</SelectItem>
                    <SelectItem value="Under Maintenance">
                      Under Maintenance
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tool-maintenance">
                  Last Maintenance Date
                </Label>
                <Input
                  id="edit-tool-maintenance"
                  type="date"
                  value={selectedTool.last_maintenance}
                  onChange={(e) =>
                    setSelectedTool({
                      ...selectedTool,
                      last_maintenance: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tool-notes">Condition Notes</Label>
                <Textarea
                  id="edit-tool-notes"
                  value={selectedTool.condition_notes}
                  onChange={(e) =>
                    setSelectedTool({
                      ...selectedTool,
                      condition_notes: e.target.value,
                    })
                  }
                  placeholder="Describe the maintenance needs or issues"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditingTool(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTool}>Update Tool</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
