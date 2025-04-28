"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectDashboard } from "@/components/project-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Listing from "@/components/listing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CompletedDevelopmentListing } from "@/components/completed-project-listing";

export default function Home() {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Project Planning</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Project Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="container mx-auto py-10">
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="projects">Project Planning</TabsTrigger>
          <TabsTrigger value="properties">SDG Development Projects</TabsTrigger>
          <TabsTrigger value="completed">Completed Projects</TabsTrigger>
        </TabsList>

        {/* Project Planning Tab */}
        <TabsContent value="projects">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Project Planning
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your construction projects, materials, and labor
                assignments
              </p>
            </div>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>

          <Suspense fallback={<DashboardSkeleton />}>
            <ProjectDashboard />
          </Suspense>
        </TabsContent>

        {/* SDG Development Projects Tab */}
        <TabsContent value="properties">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h1 className="text-3xl font-bold mb-4 md:mb-0">
              SDG Development Projects
            </h1>
          </div>
          <div className="mt-8">
            <Listing />
          </div>
        </TabsContent>

        {/* Completed Projects Tab */}
        <TabsContent value="completed">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Completed Projects
              </h1>
              <p className="text-muted-foreground mt-1">
                Browse our portfolio of successfully completed SDG Development
                projects
              </p>
            </div>
            <Button asChild>
              <Link href="/completed-projects">
                View All Completed Projects
              </Link>
            </Button>
          </div>

          <CompletedDevelopmentListing />
        </TabsContent>
      </Tabs>
      </div>
    </SidebarInset>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card text-card-foreground shadow-sm"
          >
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end">
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        ))}
    </div>
  );
}
