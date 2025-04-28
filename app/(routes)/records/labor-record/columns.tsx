"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import EditLaborDialog from "./EditLaborDialog";

// Define Labor type
export type Labor = {
  id: string;
  labor: string;
  category: string;
  quantity: number;
  cost: number;
  total_cost: number;
  created_at: string;
};

export const columns: ColumnDef<Labor>[] = [
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
    accessorKey: "labor",
    header: "Labor",
  },
  {
    accessorKey: "category",
    header: "Category",
  },
  {
    accessorKey: "quantity",
    header: "Number of Workers",
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      return <div className="text-center font-medium">{quantity}</div>;
    },
  },
  {
    accessorKey: "cost",
    header: "Daily Rate",
    cell: ({ row }) => {
      const cost = row.original.cost;
      return `₱${
        cost !== null && cost !== undefined ? cost.toFixed(2) : "0.00"
      }`;
    },
  },
  // {
  //   accessorKey: "total_cost",
  //   header: "On-Call Daily Rate",
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
      const utcDate = new Date(row.original.created_at);
      // Convert to local time if desired
      const localDate = new Date(
        utcDate.getTime() - utcDate.getTimezoneOffset() * 60000
      );
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
      const labor = row.original;
      return <EditLaborDialog labor={labor} onLaborUpdated={() => { /* handle update */ }} />;
    },
  },
];
