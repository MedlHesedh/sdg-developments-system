"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { z } from "zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AlertCircle, CalendarIcon, CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";

// ---------------------------------------
// 1) Define your Zod schema (with new fields)
// ---------------------------------------
const projectSchema = z.object({
  // Required fields
  name: z.string().min(1, "Project name is required"),
  type: z.string().min(1, "Project type is required"),
  client: z.string().min(1, "Client name is required"),
  number: z.string().min(1, "Client number is required"),
  email: z.string().email("Invalid email address"),
  date_requested: z.string().min(1, "Date requested is required"),
  target_date: z.string().min(1, "Target date is required"),

  // Optional field
  description: z.string().optional(),
});

type ProjectFormInputs = z.infer<typeof projectSchema>;

const projectTypes = [
  "Bungalow",
  "Two-Storey Residence",
  "Three-Storey Residence",
  "Two-Storey Apartment with Roofdeck",
  "Three-Storey Apartment",
  "Townhouse",
  "Duplex",
  "Commercial Building",
  "Warehouse",
];


type ProjectFormProps = {
  project?: {
    id: string;
    name: string;
    type: string;
    client: string;
    number: string;
    email: string;
    dateRequested: string;
    targetDate: string;
    description?: string;
    status: string;
  };
  isEditing?: boolean;
};

type AlertState = {
  type: "success" | "error" | null;
  message: string;
};

export function ProjectForm({ project, isEditing = false }: ProjectFormProps) {
  const router = useRouter();

  // We track a separate `status` only if editing
  const [status, setStatus] = useState(project?.status || "Planning");
  const [alertState, setAlertState] = useState<AlertState>({
    type: null,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------
  // Auto-clear alerts after 5 seconds
  // ---------------------------------------
  useEffect(() => {
    if (alertState.type) {
      const timer = setTimeout(() => {
        setAlertState({ type: null, message: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alertState]);

  // ---------------------------------------
  // 2) Initialize react-hook-form with defaultValues including new fields
  // ---------------------------------------
  const form = useForm<ProjectFormInputs>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      type: project?.type ?? "",
      client: project?.client ?? "",
      number: project?.number ?? "",
      email: project?.email ?? "",
      description: project?.description ?? "",
      // Store dates as strings for easy validation
      date_requested: project?.dateRequested
        ? new Date(project.dateRequested).toISOString()
        : "",
      target_date: project?.targetDate
        ? new Date(project.targetDate).toISOString()
        : "",
    },
  });

  // ---------------------------------------
  // 3) Handle form submission
  // ---------------------------------------
  const onSubmit: SubmitHandler<ProjectFormInputs> = async (values) => {
    setIsSubmitting(true);
    setAlertState({ type: null, message: "" });

    try {
      let supabaseResponse;
      if (isEditing && project?.id) {
        // Update existing project
        supabaseResponse = await supabase
          .from("projects")
          .update({
            name: values.name,
            type: values.type,
            client: values.client,
            number: values.number,
            email: values.email,
            description: values.description ?? "",
            date_requested: values.date_requested,
            target_date: values.target_date,
            status, // keep existing status or update from dropdown
          })
          .eq("id", project.id)
          .select()
          .single();
      } else {
        // Insert new project
        supabaseResponse = await supabase
          .from("projects")
          .insert({
            name: values.name,
            type: values.type,
            client: values.client,
            number: values.number,
            email: values.email,
            description: values.description ?? "",
            date_requested: values.date_requested,
            target_date: values.target_date,
            status: "Planning", // default to "Planning" for new
          })
          .select()
          .single();
      }

      const { error } = supabaseResponse;
      if (error) {
        throw new Error(error.message);
      }

      // Success
      setAlertState({
        type: "success",
        message: isEditing
          ? "Project updated successfully!"
          : "Project created successfully!",
      });

      // Reset the form if creating new
      if (!isEditing) {
        form.reset();
      }
    } catch (error) {
      setAlertState({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "An error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to parse the stored date string for Calendar display
  const getDateOrUndefined = (dateString: string) => {
    try {
      return dateString ? new Date(dateString) : undefined;
    } catch {
      return undefined;
    }
  };

  // ---------------------------------------
  // 4) Build the form UI
  // ---------------------------------------
  return (
    <Form {...form}>
      {/* Top-level success/error alerts with fade-in transition */}
      {alertState.type === "success" && (
        <Alert
          variant="default"
          className="absolute top-4 right-4 w-fit border-green-600 text-green-600 transition-opacity duration-300"
        >
          <CircleCheckBig className="h-4 w-4 stroke-green-600" />
          <div className="flex flex-col pr-10">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{alertState.message}</AlertDescription>
          </div>
        </Alert>
      )}
      {alertState.type === "error" && (
        <Alert
          variant="destructive"
          className="mb-4 transition-opacity duration-300"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{alertState.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>
              {isEditing ? "Edit Project" : "Create New Project"}
            </CardTitle>
            <CardDescription>
              {isEditing
                ? "Update the details of your existing project"
                : "Fill in the details to create a new construction project"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Project Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project name"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Project Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type</FormLabel>
                  <Select
                    disabled={isSubmitting}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectTypes.map((typeOption) => (
                        <SelectItem key={typeOption} value={typeOption}>
                          {typeOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client Name */}
            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter client name"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New row for Client Number and Client Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter client number"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter client email"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description (optional) */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      className="border p-2 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      rows={4}
                      placeholder="Enter project description"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates: date_requested & target_date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date Requested */}
              <FormField
                control={form.control}
                name="date_requested"
                render={({ field }) => {
                  const dateValue = getDateOrUndefined(field.value);
                  return (
                    <FormItem>
                      <FormLabel>Date Requested</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateValue && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateValue
                              ? format(dateValue, "PPP")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={(selectedDate) => {
                              field.onChange(
                                selectedDate ? selectedDate.toISOString() : ""
                              );
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Target Date */}
              <FormField
                control={form.control}
                name="target_date"
                render={({ field }) => {
                  const dateValue = getDateOrUndefined(field.value);
                  const requestedDate = getDateOrUndefined(
                    form.getValues("date_requested")
                  );
                  return (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateValue && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateValue
                              ? format(dateValue, "PPP")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={(selectedDate) => {
                              field.onChange(
                                selectedDate ? selectedDate.toISOString() : ""
                              );
                            }}
                            initialFocus
                            disabled={(date) =>
                              requestedDate ? date < requestedDate : false
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Update Project"
                : "Create Project"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
