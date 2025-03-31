"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { PriceChart } from "@/components/price-chart"
import { ForecastChart } from "@/components/forecast-chart"
import { ReportDialog } from "@/components/report-dialog"
import { TrainingDialog } from "@/components/training-dialog"
import { ModelAccuracyDialog } from "@/components/model-accuracy-dialog"
import { ForecastTable } from "@/components/forecast-table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Search,
  RefreshCw,
  BarChart2,
  LineChart,
  FileText,
  FileSpreadsheet,
  FileIcon as FilePdf,
  AlertTriangle,
} from "lucide-react"
import { fetchHistoricalData, fetchForecastData, fetchModelAccuracy } from "@/lib/api"
import { exportToCSV, exportToPDF } from "@/lib/export-utils"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { set } from "date-fns"
import { supabase } from "@/utils/supabase/client";

export default function Dashboard() {
  // Resource type and selection state
  const [resourceType, setResourceType] = useState<"material" | "labor" >("material");
  const [selectedResource, setSelectedResource] = useState<string>("")
  const [resourceOptions, setResourceOptions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Forecast parameters
  const [forecastMonths, setForecastMonths] = useState<number>(3)
  const [chartType, setChartType] = useState<"line" | "bar">("line")

  // Data state
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [forecastData, setForecastData] = useState<any[]>([])
  const [accuracyData, setAccuracyData] = useState<any[]>([])

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingResources, setIsLoadingResources] = useState<boolean>(true)
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false)

  // Dialog states
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false)
  const [isTrainingOpen, setIsTrainingOpen] = useState<boolean>(false)
  const [isAccuracyOpen, setIsAccuracyOpen] = useState<boolean>(false)

  const { toast } = useToast()

  const fetchResources = async (type: "material" | "labor"): Promise<string[]> => {
    try {
      const table = type === "material" ? "material_adding" : "labor_adding";
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.error(`Error fetching ${type} resources:`, error);
        return [];
      }
      return data.map((item) => item[type === "material" ? "material" : "labor"]);
    } catch (error) {
      console.error(`Error fetching ${type} resources:`, error);
      return [];
    }
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
  
  function useResourceSelector(resourceType: "Labor" | "Material") {
    const [labors, setLabors] = useState<LaborData[]>([]);
    const [materials, setMaterials] = useState<MaterialData[]>([]);
    const [selectedResource, setSelectedResource] = useState("");
    const [isOpen, setIsOpen] = useState(false);
  
    // Fetch data para sa workers at supplies
    useEffect(() => {
      const fetchResources = async () => {
        if (resourceType === "Labor") {
          const { data: laborData, error: laborError } = await supabase
          .from("labor_adding")
          .select("id, labor, category, quantity, cost, created_at, updated_at");
          if (laborError) {
            console.error("Error fetching workers:", laborError);
          } else {
            setLabors(laborData || []);
          }
        } else {
          const { data: materialData, error: materialError } = await supabase
          .from("material_adding")
          .select("id, material, unit, quantity, cost, created_at, updated_at");
          if (materialError) {
            console.error("Error fetching supplies:", materialError);
          } else {
            setMaterials(materialData || []);
          }
        }
      };
  
      fetchResources();
    }, [resourceType]);
  
    // I-map ang data sa options
    const laborOptions = labors.map((lab) => ({
      key: lab.id,
      value: `${lab.labor}`
    }));
  
    const materialOptions = materials.map((mat) => ({
      key: mat.id,
      value: `${mat.material} `
    }));
  
    const options = resourceType === "Labor" ? laborOptions : materialOptions;
  
    // Handle selection ng resource
    const handleSelect = (value: string) => {
      setSelectedResource(value);
      setIsOpen(false);
      return value; // I-return ang selected value para magamit sa parent component
    };
  
    return {
      options,
      selectedResource,
      handleSelect,
    };
  }
  
  useEffect(() => {
    setIsLoadingResources(true)
    setSelectedResource("")

    const fetchResourceOptions = async () => {
      try {
        const options = resourceType === "material" ? await fetchResources("material") : await fetchResources("labor")

        setResourceOptions(options)
        if (options.length > 0 ) {
          setSelectedResource(options[0])
        }
      } catch (error) {
        console.error("Error fetching resource options:", error)
        toast({
          title: "Error",
          description: "Failed to load resource options.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingResources(false)
      }
    }

    fetchResourceOptions()
  }, [resourceType, toast])

  // Load data when resource selection changes
  useEffect(() => {
    if (!selectedResource) return;
  
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [historical, forecast, accuracy] = await Promise.all([
          fetchHistoricalData(resourceType, selectedResource),
          fetchForecastData(resourceType, selectedResource, forecastMonths),
          fetchModelAccuracy(resourceType, selectedResource),
        ]);
  
        console.log("Fetched historical data:", historical);
        console.log("Fetched forecast data:", forecast);
        console.log("Fetched accuracy data:", accuracy);
  
        setHistoricalData(historical);
        setForecastData(forecast);
        setAccuracyData(accuracy);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load forecast data.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
        setIsLoading(false);
      }
    };
  
    loadData();
  }, [selectedResource, forecastMonths, resourceType, toast]);
  

  // Filter resources based on search query
  const filteredResources = resourceOptions.filter((resource) =>
    resource.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleRefresh = async () => {
    setIsLoadingData(true)
    try {
      const [historical, forecast] = await Promise.all([
        fetchHistoricalData(resourceType, selectedResource),
        fetchForecastData(resourceType, selectedResource, forecastMonths),
      ])

      setHistoricalData(historical)
      setForecastData(forecast)

      toast({
        title: "Data Refreshed",
        description: "The latest data has been loaded.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh data.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingData(false)
    }
  }


  const handleExportCSV = () => {
    try {
      exportToCSV(
        forecastData,
        `${resourceType}-${selectedResource}-forecast-${new Date().toISOString().split("T")[0]}.csv`,
      )
      toast({
        title: "Export Complete",
        description: "Data has been exported to CSV.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data to CSV.",
        variant: "destructive",
      })
    }
  }

  const handleExportPDF = () => {
    try {
      exportToPDF(
        selectedResource,
        resourceType,
        historicalData,
        forecastData,
        `${resourceType}-${selectedResource}-forecast-${new Date().toISOString().split("T")[0]}.pdf`,
      )
      toast({
        title: "Export Complete",
        description: "Data has been exported to PDF.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data to PDF.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resource Selection</CardTitle>
          <CardDescription>Choose the type of resource and specific item to forecast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <RadioGroup
              value={resourceType || ""}
              onValueChange={(value) => setResourceType(value as "material" | "labor")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="material" id="material" />
                <Label htmlFor="material">Material</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="labor" id="labor" />
                <Label htmlFor="labor">Labor</Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="resource-search">Search {resourceType }</Label>
              <Select
                value={selectedResource}
                onValueChange={setSelectedResource}
                disabled={isLoadingResources || filteredResources.length === 0}
              >
                <SelectTrigger className="mt-2">
                <SelectValue placeholder={`Select ${resourceType === "labor" ? "labor..." : "material..."}`} />
                </SelectTrigger>
                <SelectContent>
                  {/* Search Input inside SelectContent */}
                  <div className="p-2">
                    <Input
                      placeholder={`Search ${resourceType}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Filtered Resources */}
                  {filteredResources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                  {/* No Matching Resources Found */}
                  {filteredResources.length === 0 && !isLoadingResources && (
                    <div className="text-sm text-muted-foreground flex items-center p-2">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      No matching resources found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>  
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Forecast Range</CardTitle>
            <CardDescription>Adjust the number of months to forecast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              value={[forecastMonths]}
              min={1}
              max={12}
              step={1}
              onValueChange={(value) => setForecastMonths(value[0])}
              disabled={isLoadingData}
            />
            <div className="flex items-center space-x-2">
              <div className="text-center font-medium flex-1">
                {forecastMonths} month{forecastMonths > 1 ? "s" : ""}
              </div>
              <Input
                type="number"
                min={1}
                max={12}
                value={forecastMonths}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value)
                  if (!isNaN(value) && value >= 1 && value <= 12) {
                    setForecastMonths(value)
                  }
                }}
                className="w-20"
                disabled={isLoadingData}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
            <CardDescription>Export forecast data in different formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleExportCSV} variant="outline" disabled={isLoadingData}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button onClick={handleExportPDF} variant="outline" disabled={isLoadingData}>
                <FilePdf className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Refresh data or generate reports</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleRefresh} disabled={isLoadingData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={() => setIsReportOpen(true)} variant="outline" disabled={isLoadingData}>
                <FileText className="mr-2 h-4 w-4" />
                Report
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setIsTrainingOpen(true)} variant="secondary" disabled={isLoadingData}>
                Auto Train
              </Button>
              <Button
                onClick={() => setIsAccuracyOpen(true)}
                variant="secondary"
                disabled={isLoadingData || accuracyData.length === 0}
              >
                Accuracy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* <Tabs defaultValue="combined" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="combined">Combined View</TabsTrigger>
            <TabsTrigger value="historical">Historical</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
          </TabsList>

          <div className="flex space-x-2">
            <Button
              variant={chartType === "line" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("line")}
            >
              <LineChart className="h-4 w-4" />
            </Button>
            <Button variant={chartType === "bar" ? "default" : "outline"} size="sm" onClick={() => setChartType("bar")}>
              <BarChart2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="combined" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Price Trends and Forecast</CardTitle>
              <CardDescription>
                Historical data and {forecastMonths}-month forecast for {selectedResource} {resourceType}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              
            <PriceChart
              historicalData={historicalData}
              forecastData={forecastData}
              isLoading={isLoadingData}
              chartType={chartType}
              resourceType={resourceType}
            />

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Historical Price Trends</CardTitle>
              <CardDescription>
                Past price data for {selectedResource} {resourceType}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <PriceChart
                historicalData={historicalData}
                forecastData={[]}
                isLoading={isLoadingData}
                chartType={chartType}
                resourceType={resourceType}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Price Forecast</CardTitle>
              <CardDescription>
                {forecastMonths}-month forecast for {selectedResource} {resourceType}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ForecastChart
                forecastData={forecastData}
                isLoading={isLoadingData}
                chartType={chartType}
                resourceType={resourceType}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Results Table</CardTitle>
              <CardDescription>
                Detailed forecast data for {selectedResource} {resourceType}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForecastTable
                historicalData={historicalData}
                forecastData={forecastData}
                isLoading={isLoadingData}
                resourceType={resourceType}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}

      <ReportDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        resource={selectedResource}
        resourceType={resourceType}
        historicalData={historicalData}
        forecastData={forecastData}
      />

      <TrainingDialog open={isTrainingOpen} onOpenChange={setIsTrainingOpen} />

      <ModelAccuracyDialog
        open={isAccuracyOpen}
        onOpenChange={setIsAccuracyOpen}
        resource={selectedResource}
        resourceType={resourceType}
        accuracyData={accuracyData}
      />
    </div>
  )
}

