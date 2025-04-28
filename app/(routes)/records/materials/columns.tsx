"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import EditMaterialDialog from "./EditMaterialsForm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Material = {
  id: string;
  name: string;
  unitOfMeasurement: string;
  category: string;
  quantity: number;
  cost: number | 0;
  total_cost: number | 0;
  created_at: string;
};

export const columns: ColumnDef<Material>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "unitOfMeasurement",
    header: "Unit of Measurement",
  },
  {
    accessorKey: "category",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  // {
  //   accessorKey: "quantity",
  //   header: () => <div className="text-center">Quantity</div>,
  //   cell: ({ row }) => {
  //     const quantity = parseFloat(row.getValue("quantity"));
  //     return <div className="text-center font-medium">{quantity}</div>;
  //   },
  // },
  {
    accessorKey: "cost",
    header: "Cost",
    cell: ({ row }) => {
      const cost = row.original.cost;
      return `₱${
        cost !== null && cost !== undefined ? cost.toFixed(2) : "0.00"
      }`;
    },
  },
  // {
  //   accessorKey: "total_cost",
  //   header: "Total Cost",
  //   cell: ({ row }) => {
  //     const totalCost = row.original.total_cost;
  //     return `₱${
  //       totalCost !== null && totalCost !== undefined
  //         ? totalCost.toFixed(2)
  //         : "0.00"
  //     }`;
  //   },
  // },
  {
    accessorKey: "created_at",
    header: "Date Added",
    cell: ({ row }) => {
      // Parse the UTC timestamp
      const utcDate = new Date(row.original.created_at);
      // Optional: If you want to ensure local conversion explicitly (usually not needed)
      const localDate = new Date(
        utcDate.getTime() - utcDate.getTimezoneOffset() * 60000
      );
      // Format the local date string
      return localDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const material = row.original;

      return (
        <EditMaterialDialog
          material={material}
          onMaterialUpdated={(updatedMaterial) => {
            // If you need to refresh data or do anything after editing:
            // refreshMaterials();
          }}
        />
      );
    },
  },
];
