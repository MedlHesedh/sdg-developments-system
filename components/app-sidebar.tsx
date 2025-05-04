"use client"

import * as React from "react"
import {
  NotebookPen,PresentationIcon, BookOpen, Bot, Command, Frame, Container, Map, PieChart,ViewIcon, Settings2,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { NavResources } from "@/components/nav-resources"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// ✅ Define `data` before using it in `useState`
const data = {
  user: {
    name: "Medl Masangcap",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "SDG Resources",
      logo: Container,
      plan: "Enterprise",
    },
    {
      name: "SDG Platform",
      logo: NotebookPen,
      plan: "Startup",
    },
    // {
    //   name: "SDG Forecasting",
    //   logo: Command,
    //   plan: "Free",
    // },
  ],
  navMain: [
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "QR Code Help", url: "/tools/help" },
        // { title: "Get Started", url: "#" },
        // { title: "Tutorials", url: "#" },
        // { title: "Changelog", url: "#" },
      ],
    },
  ],
  navResources: [
    {
      title: "Resources",
      url: "/records",
      icon: Frame,
      items: [
        { title: "Material Record", url: "/records/materials" },
        { title: "Material History", url: "/records/material-history" },
        { title: "Labor Record", url: "/records/labor-record" },
        { title: "Labor History", url: "/records/labor-history" }, 
        // { title: "Category", url: "/records/material-category" },
      ],
    },
    {
      title: "Project Planning",
      url: "#",
      icon: Map,
      items: [
        { title: "Project Dashboard", url: "/projects" },
        { title: "Create Project Plan", url: "/projects/new" },
      ],
    },
    {
      title: "Tool Tracking",
      url: "/tracking",
      icon: Settings2,
      items: [
        { title: "Tools Inventory", url: "/tools" },
        { title: "Tool Maintenance", url: "/tools/maintenance" },
        { title: "Tool Utilization", url: "/tools/dashboard" },
        // { title: "QR Code Help", url: "/tools/help" },
      ],
    },
    {
      title: "Forecasting",
      url: "/forecasting",
      icon: PieChart,
      items: [
        { title: "Forecasting Dashboard", url: "/analytics" },
        
      ],
    },
    /* {
      title: "Reports",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "Cost Forecast Reports", url: "#" },
        { title: "Project Planning Reports", url: "#" },
      ],
    }, */
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        { title: "QR Code Help", url: "/tools/help" },
        // { title: "Get Started", url: "#" },
        // { title: "Tutorials", url: "#" },
        // { title: "Changelog", url: "#" },
      ],
    },
  ],
  projects: [
    {
      name: "Project Viewing",
      url: "#",
      icon: ViewIcon,
      items: [
        { title: "View Projects", url: "https://sdg-development.vercel.app/" },
        { title: "Project Templates", url: "https://sdg-template.vercel.app/" },
      ],
    },
    // {
    //   name: "Project Meeting",
    //   url: "#",
    //   icon: PresentationIcon,
    // },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // ✅ `data` is now defined before using `useState`
  const [selectedTeam, setSelectedTeam] = React.useState(data.teams[0].name)

  return (
    <Sidebar collapsible="icon" {...props}>
      
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} onTeamChange={(team) => setSelectedTeam(team.name)} />
      </SidebarHeader>
      <SidebarContent>
        {selectedTeam === "SDG Resources" ? (
          <NavResources items={data.navResources} />
        ) : (
          <NavMain items={data.navMain} />
        )}
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
