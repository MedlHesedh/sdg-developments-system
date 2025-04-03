"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV } from "@/lib/export-utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { supabase } from "@/utils/supabase/client";

interface ModelAccuracyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource: string
  resourceType: string
  accuracyData: any[]
  historicalData?: any[]
  forecastData?: any[]
}

interface HistoryItem {
  id: string
  name: string
  cost: number
  date: string
}

export function ModelAccuracyDialog({
  open,
  onOpenChange,
  resource,
  resourceType,
  accuracyData,
  historicalData = [],
  forecastData = [],
}: ModelAccuracyDialogProps) {
  const [forecastedCost, setForecastedCost] = useState<number | null>(null)
  const [forecastSeries, setForecastSeries] = useState<number[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open || !resource || !resourceType) return

    const fetchData = async () => {
      try {
        // Fetch forecast data
        const targetDateInMonths = 6
        const params = new URLSearchParams({
          type: resourceType.toLowerCase(),
          name: resource,
          steps: targetDateInMonths.toString(),
        })

        const forecastResponse = await fetch(`https://sdg-arima-python.onrender.com/predict?${params}`)
        const forecastData = await forecastResponse.json()
        setForecastSeries(forecastData.forecast)
        setForecastedCost(forecastData.forecast[5])

        // Fetch history data
        const tableName = resourceType === "material" ? "material_history" : "labor_history"
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .eq(resourceType === "material" ? "material" : "labor", resource)
          .order("created_at", { ascending: false })

        if (error) {
          console.error(`Error fetching ${resourceType} history`, error)
          return
        }

        setHistory(
          data.map((item) => ({
            id: item.id,
            name: resourceType === "material" ? item.material : item.labor,
            cost: item.cost ?? 0,
            date: item.date ?? "N/A",
          }))
        )
      } catch (error) {
        console.error("Error fetching data:", error)
        if (forecastData.length > 0) {
          setForecastSeries(forecastData.map((item) => item.price))
          setForecastedCost(forecastData[forecastData.length - 1].price)
        } else if (historicalData.length > 0) {
          setForecastSeries([historicalData[historicalData.length - 1].price])
          setForecastedCost(historicalData[historicalData.length - 1].price)
        } else {
          setForecastSeries([])
          setForecastedCost(null)
        }
      }
    }

    fetchData()
  }, [open, resource, resourceType, forecastData, historicalData])

  const formatDate = (dateStr: string) => {
    if (dateStr === "N/A") return "N/A"
    const date = new Date(dateStr)
    return isMobile
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const formatPrice = (price: number) => {
    return resourceType === "labor" ? `₱${price.toFixed(2)}` : `₱${price.toFixed(2)}`
  }

  const calculateOverallMetrics = () => {
    if (!accuracyData.length) return { mape: 0, rmse: 0 }

    const totalError = accuracyData.reduce((sum, item) => sum + Math.abs(item.errorPercent), 0)
    const mape = totalError / accuracyData.length

    const squaredErrors = accuracyData.map((item) => {
      const error = item.actualPrice - item.forecastedPrice
      return error * error
    })
    const mse = squaredErrors.reduce((sum, error) => sum + error, 0) / squaredErrors.length
    const rmse = Math.sqrt(mse)

    return { mape, rmse }
  }

  const metrics = calculateOverallMetrics()
  const latestData = accuracyData.length > 0 ? accuracyData[accuracyData.length - 1] : null

  const handleExportAccuracy = () => {
    try {
      // Prepare the data for export
      const exportData = [];
      
      // Add metrics
      exportData.push({
        "Metric": "Mean Absolute Percentage Error (MAPE)",
        "Value": `${metrics.mape.toFixed(2)}%`,
        "Description": "Lower is better. Represents average percentage error."
      });
      
      exportData.push({
        "Metric": "Root Mean Square Error (RMSE)",
        "Value": `₱${metrics.rmse.toFixed(2)}`,
        "Description": "Lower is better. Represents magnitude of error."
      });
      
      exportData.push({}); // Empty row for separation
      
      // Add latest accuracy data
      if (latestData) {
        exportData.push({
          "Date": formatDate(latestData.date),
          "Historical Price": formatPrice(latestData.actualPrice),
          // "Error": `${latestData.errorPercent > 0 ? "+" : ""}${latestData.errorPercent.toFixed(2)}%`,
          "Future Forecast": forecastedCost !== null ? formatPrice(forecastedCost) : "N/A"
        });
      }
      
      exportData.push({}); // Empty row for separation
      
      // Add history if available
      if (history.length > 0) {
        exportData.push({
          [`${resourceType} History`]: "Date",
          "": resourceType === "material" ? "Material" : "Labor",
          "  ": "Cost"
        });
        
        history.forEach(item => {
          exportData.push({
            [`${resourceType} History`]: formatDate(item.date),
            "": item.name,
            "  ": formatPrice(item.cost)
          });
        });
      }
      
      exportToCSV(
        exportData, 
        `${resourceType}-${resource}-report-${new Date().toISOString().split("T")[0]}.csv`
      );
      
      toast({
        title: "Export Complete",
        description: "Report data has been exported to CSV.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export report data.",
        variant: "destructive",
      })
    }
  }

  const renderError = (errorPercent: number) => {
    return (
      <span className={`flex items-center ${errorPercent > 0 ? "text-destructive" : "text-green-600"}`}>
        {errorPercent > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
        {Math.abs(errorPercent).toFixed(2)}%
      </span>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-[90vh] md:h-auto overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-2">
          <DialogTitle>Model Accuracy Report</DialogTitle>
          <DialogDescription>
            Accuracy assessment for {resource} {resourceType} price forecasting model
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols gap-4">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="text-sm text-muted-foreground">Mean Absolute Percentage Error (MAPE)</div>
                <div className="text-2xl font-bold mt-1">{metrics.mape.toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-full">
                  Lower is better. Represents average percentage error.
                </div>
              </CardContent>
            </Card>

            {/* <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 flex flex-col items-center sm:items-start text-center sm:text-left">
                <div className="text-sm text-muted-foreground">Root Mean Square Error (RMSE)</div>
                <div className="text-2xl font-bold mt-1">₱{metrics.rmse.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                  Lower is better. Represents magnitude of error.
                </div>
              </CardContent>
            </Card> */}
          </div>

          <div className="rounded-md border shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Historical Price</TableHead>
                    {/* <TableHead className="whitespace-nowrap">Error</TableHead> */}
                    <TableHead className="whitespace-nowrap">Future Forecast</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestData ? (
                    <>
                      <TableRow className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium">{formatDate(latestData.date)}</TableCell>
                        <TableCell>
                          <button 
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            View History
                            {showHistory ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        {/* <TableCell>{renderError(latestData.errorPercent)}</TableCell> */}
                        <TableCell>
                          {forecastedCost !== null ? (
                            <span className="font-medium">{formatPrice(forecastedCost)}</span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {showHistory && history.length > 0 && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={4} className="p-0">
                            <div className="max-h-60 overflow-y-auto">
                              <Table>
                                <TableHeader className="bg-muted/30">
                                  <TableRow>
                                    <TableHead className="w-[120px]">Date</TableHead>
                                    <TableHead>{resourceType === "material" ? "Material" : "Labor"}</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {history.map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-medium">{formatDate(item.date)}</TableCell>
                                      <TableCell>{item.name}</TableCell>
                                      <TableCell className="text-right">{formatPrice(item.cost)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <span>No accuracy data available</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* <div className="flex justify-end mt-4">
            <Button
              onClick={handleExportAccuracy}
              variant="outline"
              className="shadow-sm hover:shadow-md transition-shadow"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div> */}
        </div>
      </DialogContent>
    </Dialog>
  )
}