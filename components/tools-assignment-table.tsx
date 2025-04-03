"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  QrCode,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase/client";
import { QRCodeGenerator } from "./qr-code-generator";
import { useToolsAssignmentIntegration } from "./tools-assignment-integration";

type Tool = {
  id: string;
  name: string;
  serialNumber: string;
  status: "Available" | "Not Available" | "Under Maintenance";
  assignedDate: string | null;
  returnDate: string | null;
  assignmentId?: string;
};

type NewToolForm = {
  name: string;
  serialNumbers: string[];
  quantity: number;
  assignedDate: string;
  returnDate: string | null;
};

interface ToolsAssignmentTableProps {
  projectId: string;
  onNoToolAssigned?: () => void;
  isCompleted?: boolean;
}

export function ToolsAssignmentTable({
  projectId,
  onNoToolAssigned,
  isCompleted = false,
}: ToolsAssignmentTableProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [viewMoreDialogOpen, setViewMoreDialogOpen] = useState(false);
  const [viewMoreToolGroup, setViewMoreToolGroup] = useState<Tool[]>([]);
  const [availableTools, setAvailableTools] = useState<
    { id: string; name: string; serialNumbers: string[] }[]
  >([]);
  const [newTool, setNewTool] = useState<NewToolForm>({
    name: "",
    serialNumbers: [],
    quantity: 1,
    assignedDate: new Date().toISOString().split("T")[0],
    returnDate: null,
  });

  const { assignToolToProject, returnToolFromProject } =
    useToolsAssignmentIntegration();

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);

        const { data: assignedTools, error: assignedError } = await supabase
          .from("tool_assignments")
          .select(
            `
              id,
              assigned_date,
              return_date,
              status,
              tool_serial_id,
              tool_serial_numbers(
                id,
                serial_number,
                status,
                tool_id,
                tools(
                  id,
                  name
                )
              )
            `
          )
          .eq("project_id", projectId)
          .eq("status", "Assigned");

        if (assignedError) throw assignedError;

        const formattedTools = (assignedTools || [])
          .map((assignment: any) => {
            const toolSerial = assignment.tool_serial_numbers;
            if (!toolSerial) return null;
            const tool = toolSerial.tools;
            if (!tool) return null;
            return {
              id: tool.id,
              name: tool.name,
              serialNumber: toolSerial.serial_number,
              status: toolSerial.status as
          | "Available"
          | "Not Available"
          | "Under Maintenance",
              assignedDate: assignment.assigned_date,
              returnDate: assignment.return_date,
              assignmentId: assignment.id,
            } as Tool;
          })
          .filter((tool): tool is Tool => tool !== null);

        setTools(formattedTools);

        const { data: availableToolsData, error: availableError } =
          await supabase
            .from("tools")
            .select(
              `
                id,
                name,
                tool_serial_numbers(
                  id,
                  serial_number,
                  status
                )
              `
            )
            .order("name");

        if (availableError) throw availableError;

        const formattedAvailableTools = (availableToolsData || [])
          .map((tool) => ({
            id: tool.id,
            name: tool.name,
            serialNumbers: tool.tool_serial_numbers
              .filter((sn: any) => sn.status === "Available")
              .map((sn: any) => sn.serial_number),
          }))
          .filter((tool) => tool.serialNumbers.length > 0);

        setAvailableTools(formattedAvailableTools);
      } catch (error) {
        console.error("Error fetching tools:", error);
        toast({
          title: "Error",
          description: "Failed to load tools. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, [projectId]);

  const handleSerialNumberToggle = (serial: string, checked: boolean) => {
    setNewTool((prev) => {
      let newSerialNumbers;
      if (checked) {
        newSerialNumbers = [...prev.serialNumbers, serial];
      } else {
        newSerialNumbers = prev.serialNumbers.filter((s) => s !== serial);
      }
      return { ...prev, serialNumbers: newSerialNumbers };
    });
  };

  const handleSelectNSerials = () => {
    if (!newTool.name) return;
    const needed = newTool.quantity - newTool.serialNumbers.length;
    if (needed <= 0) return;
    const selectedToolSerialNumbers =
      availableTools.find((t) => t.id === newTool.name)?.serialNumbers || [];
    const unselected = selectedToolSerialNumbers.filter(
      (sn) => !newTool.serialNumbers.includes(sn)
    );
    const picked = unselected.slice(0, needed);
    if (picked.length === 0) return;
    setNewTool((prev) => ({
      ...prev,
      serialNumbers: [...prev.serialNumbers, ...picked],
    }));
  };

  const handleAddTool = async () => {
    if (!newTool.name || newTool.serialNumbers.length !== newTool.quantity) {
      toast({
        title: "Validation Error",
        description: `Please select exactly ${newTool.quantity} serial number(s).`,
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const toolDetails = availableTools.find((t) => t.id === newTool.name);
      if (!toolDetails) {
        throw new Error("Selected tool not found in available tools.");
      }
      const newAssignments: Tool[] = [];
      for (const serial of newTool.serialNumbers) {
        const result = await assignToolToProject(
          projectId,
          serial,
          newTool.assignedDate || new Date().toISOString().split("T")[0],
          newTool.returnDate || undefined
        );
        if (!result.success) {
          throw new Error(result.error);
        }
        newAssignments.push({
          id: newTool.name,
          name: toolDetails.name,
          serialNumber: serial,
          status: "Not Available",
          assignedDate:
            newTool.assignedDate || new Date().toISOString().split("T")[0],
          returnDate: newTool.returnDate ?? null,
          assignmentId: result.assignment?.id,
        });
      }
      setTools([...tools, ...newAssignments]);
      setAvailableTools((prev) =>
        prev
          .map((tool) => {
            if (tool.id === newTool.name) {
              return {
                ...tool,
                serialNumbers: tool.serialNumbers.filter(
                  (sn) => !newTool.serialNumbers.includes(sn)
                ),
              };
            }
            return tool;
          })
          .filter((tool) => tool.serialNumbers.length > 0)
      );
      setNewTool({
        name: "",
        serialNumbers: [],
        quantity: 1,
        assignedDate: new Date().toISOString().split("T")[0],
        returnDate: null,
      });
      setIsAddingTool(false);
      toast({
        title: "Success",
        description: "Tool(s) assigned to project successfully.",
      });
    } catch (error) {
      console.error("Error adding tool:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to assign tool to project",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnTool = async (tool: Tool) => {
    if (!tool.assignmentId) {
      toast({
        title: "Error",
        description: "Cannot return tool: missing assignment ID.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await returnToolFromProject(tool.assignmentId);
      if (!result.success) {
        throw new Error(result.error);
      }
      setTools((prev) =>
        prev.filter((t) => t.assignmentId !== tool.assignmentId)
      );
      const toolExists = availableTools.some((t) => t.id === tool.id);
      if (toolExists) {
        setAvailableTools(
          availableTools.map((t) => {
            if (t.id === tool.id) {
              return {
                ...t,
                serialNumbers: [...t.serialNumbers, tool.serialNumber],
              };
            }
            return t;
          })
        );
      } else {
        setAvailableTools((prev) => [
          ...prev,
          {
            id: tool.id,
            name: tool.name,
            serialNumbers: [tool.serialNumber],
          },
        ]);
      }
      toast({
        title: "Success",
        description: `Tool ${tool.serialNumber} has been returned.`,
      });
    } catch (error) {
      console.error("Error returning tool:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to return tool.",
        variant: "destructive",
      });
    }
  };

  const handleShowQRCode = (tool: Tool) => {
    setSelectedTool(tool);
    setShowQRCode(true);
  };

  const handleViewMore = (group: Tool[]) => {
    setViewMoreToolGroup(group);
    setViewMoreDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Group tools by name for display
  const groupedTools = tools.reduce<Record<string, Tool[]>>((acc, tool) => {
    if (!acc[tool.name]) {
      acc[tool.name] = [];
    }
    acc[tool.name].push(tool);
    return acc;
  }, {});

  useEffect(() => {
    if (!isLoading && tools.length === 0 && onNoToolAssigned) {
      onNoToolAssigned();
    }
  }, [tools, isLoading, onNoToolAssigned]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tools Assignment</h2>
        {/* Only show Add Tool button if project is not completed */}
        {!isCompleted && (
          <Sheet open={isAddingTool} onOpenChange={setIsAddingTool}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Tool
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add Tool</SheetTitle>
                <SheetDescription>
                  Add a new tool to the project
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label htmlFor="tool-name">Tool</Label>
                  <Select
                    value={newTool.name}
                    onValueChange={(value) =>
                      setNewTool({
                        name: value,
                        serialNumbers: [],
                        quantity: 1,
                        assignedDate: new Date().toISOString().split("T")[0],
                        returnDate: null,
                      })
                    }
                  >
                    <SelectTrigger id="tool-name" disabled={isSubmitting}>
                      <SelectValue placeholder="Select a tool" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTools.map((tool) => (
                        <SelectItem key={tool.id} value={tool.id}>
                          {tool.name} ({tool.serialNumbers.length} available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newTool.name && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tool-quantity">Quantity</Label>
                      <Input
                        id="tool-quantity"
                        type="number"
                        min={1}
                        max={
                          availableTools.find((t) => t.id === newTool.name)
                            ?.serialNumbers.length || 1
                        }
                        value={newTool.quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value, 10) || 1;
                          setNewTool((prev) => ({
                            ...prev,
                            quantity: qty,
                            serialNumbers: [],
                          }));
                        }}
                        disabled={isSubmitting}
                      />
                      <div className="text-sm text-muted-foreground">
                        Available:{" "}
                        {
                          availableTools.find((t) => t.id === newTool.name)
                            ?.serialNumbers.length
                        }
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleSelectNSerials}
                      disabled={!newTool.name || isSubmitting}
                    >
                      Select {newTool.quantity} Serial(s)
                    </Button>
                    <div className="space-y-2">
                      <Label>
                        Serial Numbers (Select exactly {newTool.quantity})
                      </Label>
                      <div className="max-h-40 overflow-y-auto space-y-2 border p-2 rounded">
                        {(
                          availableTools.find((t) => t.id === newTool.name)
                            ?.serialNumbers || []
                        ).map((serial) => {
                          const isChecked =
                            newTool.serialNumbers.includes(serial);
                          const canCheckMore =
                            !isChecked &&
                            newTool.serialNumbers.length >= newTool.quantity;
                          return (
                            <div
                              key={serial}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  handleSerialNumberToggle(
                                    serial,
                                    Boolean(checked)
                                  )
                                }
                                disabled={canCheckMore || isSubmitting}
                              />
                              <span>{serial}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tool-assigned">Assigned Date</Label>
                  <Input
                    id="tool-assigned"
                    type="date"
                    value={newTool.assignedDate || ""}
                    onChange={(e) =>
                      setNewTool((prev) => ({
                        ...prev,
                        assignedDate: e.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-return">
                    Expected Return Date (Optional)
                  </Label>
                  <Input
                    id="tool-return"
                    type="date"
                    value={newTool.returnDate || ""}
                    onChange={(e) =>
                      setNewTool((prev) => ({
                        ...prev,
                        returnDate: e.target.value,
                      }))
                    }
                    min={newTool.assignedDate || ""}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingTool(false)}
                >
                  Cancel
                </Button>
                <Button disabled={isSubmitting} onClick={handleAddTool}>
                  {isSubmitting ? "Adding Tool..." : "Add Tool"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tools List</CardTitle>
          <CardDescription>
            Manage tools for this project with QR code tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Serial Number(s)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Return Date</TableHead>
                {/* Hide actions if project is completed */}
                {!isCompleted && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={isCompleted ? 5 : 6}
                    className="text-center py-10"
                  >
                    <div className="flex justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mt-2">
                      Loading tools...
                    </p>
                  </TableCell>
                </TableRow>
              ) : Object.keys(groupedTools).length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isCompleted ? 5 : 6}
                    className="text-center text-muted-foreground py-6"
                  >
                    No tools assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedTools).map(([toolName, toolGroup]) => {
                  const statuses = toolGroup.map((t) => t.status);
                  const allSameStatus = statuses.every(
                    (s) => s === statuses[0]
                  );
                  const displayStatus = allSameStatus ? statuses[0] : "Mixed";
                  const assignedDates = toolGroup
                    .map((t) => t.assignedDate)
                    .filter(Boolean) as string[];
                  let earliestAssigned = null;
                  if (assignedDates.length) {
                    earliestAssigned = new Date(
                      Math.min(
                        ...assignedDates.map((d) => new Date(d).getTime())
                      )
                    );
                  }
                  const returnDates = toolGroup
                    .map((t) => t.returnDate)
                    .filter(Boolean) as string[];
                  let earliestReturn = null;
                  if (returnDates.length) {
                    earliestReturn = new Date(
                      Math.min(...returnDates.map((d) => new Date(d).getTime()))
                    );
                  }
                  return (
                    <TableRow key={toolName}>
                      <TableCell>{toolName}</TableCell>
                      <TableCell>
                        {toolGroup.slice(0, 2).map((t) => (
                          <span
                            key={t.serialNumber}
                            className="inline-flex items-center gap-2 mr-4"
                          >
                            <span>{t.serialNumber}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleShowQRCode(t)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </span>
                        ))}
                        {toolGroup.length > 2 && (
                          <Button
                            variant="link"
                            className="p-0"
                            onClick={() => handleViewMore(toolGroup)}
                          >
                            View More
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {displayStatus === "Not Available" ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 hover:bg-amber-100/80"
                          >
                            Assigned
                          </Badge>
                        ) : displayStatus === "Available" ||
                          displayStatus === "Under Maintenance" ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 hover:bg-amber-100/80"
                          >
                            {displayStatus}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Mixed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {earliestAssigned
                          ? earliestAssigned.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {earliestReturn
                          ? earliestReturn.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "-"}
                      </TableCell>
                      {!isCompleted && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              toolGroup.forEach((t) => handleReturnTool(t));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Return All</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent>
          <DialogHeader>
        <DialogTitle>QR Code for {selectedTool?.name}</DialogTitle>
        <DialogDescription>
          Scan this QR code to track this tool
        </DialogDescription>
          </DialogHeader>
          <QRCodeGenerator
        serialNumber={selectedTool?.serialNumber || ""}
        toolName={selectedTool?.name || ""}
          />
          <Button
        onClick={() => {
          if (selectedTool) {
            window.location.href = `/tools/${selectedTool.id}`;
          }
        }}
          >
        Go to Tool Details
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={viewMoreDialogOpen} onOpenChange={setViewMoreDialogOpen}>
        <DialogContent className="max-h-[400px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Serial Numbers</DialogTitle>
            <DialogDescription>
              List of all serial numbers for this tool
            </DialogDescription>
          </DialogHeader>
          <div>
            {viewMoreToolGroup.map((t) => (
              <div
                key={t.serialNumber}
                className="flex items-center gap-2 mb-2"
              >
                <span>{t.serialNumber}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShowQRCode(t)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
