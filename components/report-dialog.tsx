"use client"

import { DialogFooter } from "@/components/ui/dialog"
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PriceChart } from "@/components/price-chart"
import { toPng, toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource: string
  resourceType: string
  historicalData: any[]
  forecastData: any[]
}

export function ReportDialog({
  open,
  onOpenChange,
  resource,
  resourceType,
  historicalData,
  forecastData,
}: ReportDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [forecastedCost, setForecastedCost] = useState<number | null>(null)
  const [forecastSeries, setForecastSeries] = useState<number[]>([])
  const { toast } = useToast()
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !resource || !resourceType) return

    const fetchForecast = async () => {
      try {
        const targetDateInMonths = 6
        const params = new URLSearchParams({
          type: resourceType.toLowerCase(),
          name: resource,
          steps: targetDateInMonths.toString(),
        })

        const response = await fetch(`https://sdg-arima.onrender.com/predict?${params}`)
        const data = await response.json()
        setForecastSeries(data.forecast)
        setForecastedCost(data.forecast[5])
      } catch (error) {
        console.error("Error fetching forecast:", error)
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

    fetchForecast()
  }, [open, resource, resourceType, forecastData, historicalData])

  const handleGenerateReport = async () => {
    if (!reportRef.current) return;
    
    setIsGenerating(true);
    
    try {
      const canvas = await toCanvas(reportRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
  
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Set margins (10mm on each side)
      const margin = 10;
      const pageWidth = 210 - margin * 2; // A4 width minus margins
      const pageHeight = 297 - margin * 2; // A4 height minus margins
      
      // Calculate dimensions to fit within margins while maintaining aspect ratio
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add image with margins
      pdf.addImage(
        imgData, 
        'PNG', 
        margin, 
        margin, 
        imgWidth, 
        imgHeight,
        undefined,
        'FAST'
      );
      
      pdf.save(`${resourceType}-${resource}-report-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "Report Downloaded",
        description: "Your report has been downloaded as PDF.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateStats = () => {
    if (!historicalData.length || forecastSeries.length === 0 || forecastedCost === null) return null

    const historicalAvg = historicalData.reduce((sum, item) => sum + item.price, 0) / historicalData.length
    const forecastAvg = forecastSeries.reduce((sum, price) => sum + price, 0) / forecastSeries.length
    const percentChange = ((forecastAvg - historicalAvg) / historicalAvg) * 100

    return {
      lastHistorical: historicalData[historicalData.length - 1]?.price || 0,
      lastForecast: forecastedCost,
      percentChange,
      historicalAvg,
      forecastAvg,
    }
  }

  const stats = calculateStats()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] overflow-y-auto max-h-[90vh]">
        <div ref={reportRef}>
          <DialogHeader>
            <DialogTitle>Price Forecast Report</DialogTitle>
            <DialogDescription>
              Comprehensive report for {resource} {resourceType} price forecast
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Tabs defaultValue="summary">
              <TabsList className="mb-4 w-full flex">
                <TabsTrigger value="summary" className="flex-1">
                  Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    Price Forecast Summary for {resource} {resourceType}
                  </h3>

                  {stats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                          <div className="text-xl sm:text-2xl font-bold">
                            {resourceType === "labor"
                              ? `₱${stats.lastForecast.toFixed(2)}`
                              : `₱${stats.lastForecast.toFixed(2)}`}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Forecasted Price</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                          <div className="text-xl sm:text-2xl font-bold">
                            {stats.percentChange >= 0 ? "+" : ""}
                            {stats.percentChange.toFixed(2)}%
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Expected Change</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                          <div className="text-xl sm:text-2xl font-bold">
                            {resourceType === "labor"
                              ? `₱${stats.forecastAvg.toFixed(2)}`
                              : `₱${stats.forecastAvg.toFixed(2)}`}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            Average Forecast ({forecastSeries.length} months)
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                            <Skeleton className="h-8 w-24 mb-2" />
                            <Skeleton className="h-4 w-32" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="bg-muted p-3 sm:p-4 rounded-md">
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Analysis</h4>
                    <p className="text-xs sm:text-sm">
                      Based on our ARIMA forecasting model, the price of {resource} {resourceType} is expected to
                      {stats && stats.percentChange >= 0 ? " increase " : " decrease "}
                      by {stats ? Math.abs(stats.percentChange).toFixed(2) : "0"}% over the next {forecastSeries.length}{" "}
                      months. The average projected price during this period is{" "}
                      {stats
                        ? resourceType === "labor"
                          ? `₱${stats.forecastAvg.toFixed(2)}`
                          : `₱${stats.forecastAvg.toFixed(2)}`
                        : "unavailable"}
                      .
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-4">
          <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full sm:w-auto">
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate & Download Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}