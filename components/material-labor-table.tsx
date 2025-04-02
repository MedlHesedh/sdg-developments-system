"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type MaterialLaborItem = {
  id: string;
  type: "Material" | "Labor";
  name: string;
  unit: string;
  quantity: number;
  duration: number | null;
  cost: number;
  total_cost: number;
};

type LaborData = {
  id: string;
  labor: string;
  category: string;
  quantity: number;
  cost: number;
  created_at?: string;
  updated_at?: string;
};

type MaterialData = {
  id: string;
  material: string;
  unit: string;
  quantity: number;
  cost: number;
  created_at?: string;
  updated_at?: string;
};

interface MaterialLaborTableProps {
  projectId: string;
  onNoItems?: () => void;
  onGrandTotalChange?: (totalCost: number) => void;
  isCompleted?: boolean; // if true, hide/disable add & delete actions
}

export function MaterialLaborTable({
  projectId,
  onNoItems,
  onGrandTotalChange,
  isCompleted = false,
}: MaterialLaborTableProps) {
  const [items, setItems] = useState<MaterialLaborItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [laborList, setLaborList] = useState<LaborData[]>([]);
  const [materialList, setMaterialList] = useState<MaterialData[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MaterialLaborItem>>({
    type: "Material",
    name: "",
    quantity: 0,
    cost: 0,
    unit: "",
    duration: null,
  });
  // Tracks the available quantity of selected material/labor item
  /* TEMPORARILY DISABLED - AVAILABLE TRACKING
  const [available, setAvailable] = useState<number>(0);
  */
  const [dbCost, setDbCost] = useState<number>(0);


  const [forecastedCost, setForecastedCost] = useState(0);


  useEffect(() => {
    if (!newItem.name || !newItem.type) return;
    
    const targetDateInMonths = 6;
    const params = new URLSearchParams({
      type: newItem.type.toLowerCase(),
      name: newItem.name,
      steps: targetDateInMonths.toString()
    });

    fetch(`https://sdg-arima-python.onrender.com/predict?${params}`)
      .then(response => response.json())
      .then(data => {
        console.log(data.forecast);
        setForecastedCost(data.forecast[5]);
      })
      .catch(error => {
        console.error("Error fetching forecast:", error);
        setForecastedCost(dbCost); // Fallback to database cost if prediction fails
      });
  }, [newItem.name, newItem.type]);

  useEffect(() => {
    fetchItems();
  }, [projectId]);

  useEffect(() => {
    if (!loading && items.length === 0 && onNoItems) {
      onNoItems();
    }
  }, [items, loading, onNoItems]);

  // Calculate totals and notify parent of grand total change
  const totalMaterialCost = items
    .filter((i) => i.type === "Material")
    .reduce((sum, i) => sum + i.total_cost, 0);
  const totalLaborCost = items
    .filter((i) => i.type === "Labor")
    .reduce((sum, i) => sum + i.total_cost, 0);
  const grandTotal = totalMaterialCost + totalLaborCost;

  useEffect(() => {
    if (onGrandTotalChange) {
      onGrandTotalChange(grandTotal);
    }
  }, [grandTotal, onGrandTotalChange]);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("materials_labor")
      .select("*")
      .eq("project_id", projectId);

    if (error) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        unit: row.unit,
        quantity: row.quantity,
        duration: row.duration,
        cost: row.cost,
        total_cost: row.total_cost,
      }));
      setItems(mapped);
    }
    setLoading(false);
  }

  useEffect(() => {
    async function fetchAllData() {
      const { data: laborData, error: laborError } = await supabase
        .from("labor_adding")
        .select("id, labor, category, quantity, cost, created_at, updated_at");
      if (laborError) {
        toast({
          title: "Error",
          description: "Failed to fetch labor data",
          variant: "destructive",
        });
      } else {
        setLaborList(laborData || []);
      }

      const { data: materialData, error: materialError } = await supabase
        .from("material_adding")
        .select("id, material, unit, quantity, cost, created_at, updated_at");
      if (materialError) {
        toast({
          title: "Error",
          description: "Failed to fetch material data",
          variant: "destructive",
        });
      } else {
        setMaterialList(materialData || []);
      }
    }
    fetchAllData();
  }, []);

  const handleSelectName = (val: string) => {
    const strippedName = val;
    if (newItem.type === "Labor") {
      const selected = laborList.find((lab) => lab.labor === strippedName);
      if (selected) {
        setNewItem((prev) => ({
          ...prev,
          name: selected.labor,
          unit: "", // for labor, unit will be set to "day" in the table rendering
        }));
        /* TEMPORARILY DISABLED - AVAILABLE TRACKING
        setAvailable(selected.quantity);
        */
        setDbCost(selected.cost);
      }
    } else {
      const selected = materialList.find(
        (mat) => mat.material === strippedName
      );
      if (selected) {
        setNewItem((prev) => ({
          ...prev,
          name: selected.material,
          unit: selected.unit,
        }));
        /* TEMPORARILY DISABLED - AVAILABLE TRACKING
        setAvailable(selected.quantity);
        */
        setDbCost(selected.cost);
      }
    }
  };

  // Update quantity handler: Validates against available quantity
  const handleQuantityChange = (value: number) => {
    // Quantity validation is done in the Input component's onChange handler
    setNewItem((prev) => ({
      ...prev,
      quantity: value,
      cost: prev.type === "Material" ? dbCost * value : dbCost,
    }));
  };

  const handleDurationChange = (value: number) => {
    setNewItem((prev) => ({
      ...prev,
      duration: value,
    }));
  };

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.quantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Calculate total cost based on type using forecasted cost
    let total_cost = 0;
    if (newItem.type === "Labor") {
      total_cost = forecastedCost * (newItem.quantity || 0) * (newItem.duration || 1);
    } else {
      total_cost = forecastedCost * (newItem.quantity || 0);
    }

    const { error } = await supabase.from("materials_labor").insert({
      project_id: projectId,
      type: newItem.type,
      name: newItem.name,
      unit: newItem.type === "Labor" ? "" : newItem.unit,
      quantity: newItem.quantity,
      duration: newItem.type === "Labor" ? newItem.duration : null,
      cost: forecastedCost, // use forecasted cost instead of dbCost
      total_cost,
    });

    if (error) {
      toast({
        title: "Error adding item",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchItems();
      setNewItem({
        type: newItem.type,
        name: "",
        quantity: 0,
        cost: 0,
        unit: "",
        duration: newItem.type === "Labor" ? 0 : null,
      });
      setDbCost(0);
      /* TEMPORARILY DISABLED - AVAILABLE TRACKING
      setAvailable(0);
      */
      setIsAddingItem(false);
      toast({ title: "Item added successfully!" });
    }
  };

  async function addItem() {
    if (!newItem.name || !newItem.cost || !newItem.quantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const totalCost = (newItem.quantity || 0) * (newItem.cost || 0);
    const itemToAdd = {
      ...newItem,
      project_id: projectId,
      total_cost: totalCost,
    };

    const { error } = await supabase.from("materials_labor").insert([itemToAdd]);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Item added successfully" });
      setIsAddingItem(false);
      fetchItems();
    }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("materials_labor").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    } else {
      toast({ title: "Success", description: "Item deleted successfully" });
      fetchItems();
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
    }).format(amount);

// Function to render a combobox for selecting labor or materials in a project  
  function NameCombobox() {
    const [open, setOpen] = useState(false);
    const selectedValue = newItem.name
      /* TEMPORARILY DISABLED - AVAILABLE TRACKING
      ? `${newItem.name} (${available} available)`
      */
      ? newItem.name
      : "";
    const laborOptions = laborList.map((lab) => ({
      key: lab.id,
      value: `${lab.labor}`,//(${lab.quantity} available)
    }));
    const materialOptions = materialList.map((mat) => ({
      key: mat.id,
      value: `${mat.material} `,//(${mat.quantity} available)
    }));
    const list = newItem.type === "Labor" ? laborOptions : materialOptions;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedValue ||
              (newItem.type === "Labor"
                ? "Select labor..."
                : "Select material...")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder={
                newItem.type === "Labor"
                  ? "Search labor..."
                  : "Search material..."
              }
            />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty>No matching items found.</CommandEmpty>
              <CommandGroup>
                {list.map((obj) => (
                  <CommandItem
                    key={obj.key}
                    value={obj.value}
                    onSelect={(currentValue) => {
                      handleSelectName(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValue === obj.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {obj.value}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Materials & Labor Assignment</h2>
        {/* Hide add item button if project is completed */}
        {!isCompleted && (
          <Sheet open={isAddingItem} onOpenChange={setIsAddingItem}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add Material or Labor</SheetTitle>
                <SheetDescription>
                  Add a new record to your project
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4 px-4">
                <div className="space-y-2">
                  <Label htmlFor="item-type">Type</Label>
                  <Select
                    value={newItem.type}
                    onValueChange={(value) => {
                      setNewItem({
                        type: value as "Material" | "Labor",
                        name: "",
                        quantity: 0,
                        cost: 0,
                        unit: "",
                        duration: value === "Labor" ? 0 : null,
                      });
                      /* TEMPORARILY DISABLED - AVAILABLE TRACKING
                      setAvailable(0);
                      */
                      setDbCost(0);
                    }}
                  >
                    <SelectTrigger id="item-type" className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Material">Material</SelectItem>
                      <SelectItem value="Labor">Labor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <NameCombobox />
                </div>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Label>Unit</Label>
                    <div className="text-sm text-muted-foreground">
                      {newItem.type === "Labor" ? "day" : newItem.unit || "-"}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Label>Cost (PHP)</Label>
                    <div className="text-sm text-muted-foreground">
                        {(forecastedCost || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    /* TEMPORARILY DISABLED - AVAILABLE TRACKING
                    max={available || 1}
                    */
                    value={newItem.quantity?.toString() || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      /* TEMPORARILY DISABLED - AVAILABLE TRACKING
                      if (val > available) {
                        toast({
                          title: "Quantity Limit",
                          description: `Maximum available is ${available}.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      */
                      handleQuantityChange(val);
                    }}
                  />
                </div>
                {newItem.type === "Labor" && (
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newItem.duration?.toString() || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val < 1) {
                          toast({
                            title: "Invalid Duration",
                            description: "Duration cannot be less than 1.",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleDurationChange(val);
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-4 pb-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingItem(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddItem}>Add Item</Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Materials & Labor List</CardTitle>
          <CardDescription>Manage your records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Cost (PHP)</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  {/* Hide delete actions if project is completed */}
                  {!isCompleted && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isCompleted ? 7 : 8}
                      className="text-center text-muted-foreground py-6"
                    >
                      No items added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.type === "Labor" ? "day" : item.unit || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.duration !== null ? item.duration : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.cost)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_cost)}
                      </TableCell>
                      {!isCompleted && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Material Cost:</span>
              <span className="font-medium">
                {formatCurrency(totalMaterialCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Labor Cost:</span>
              <span className="font-medium">
                {formatCurrency(totalLaborCost)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">Grand Total:</span>
              <span className="font-semibold">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
