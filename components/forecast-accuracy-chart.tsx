"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info, Maximize2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts"
import { supabase } from "@/utils/supabase/client"

interface ForecastAccuracyChartProps {
  resourceType: "material" | "labor"
  resource: string
  onViewAccuracyDetails: () => void
  chartType?: "line" | "area"
}

export function ForecastAccuracyChart({ resourceType, resource, onViewAccuracyDetails, chartType = "area" }: ForecastAccuracyChartProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState({ mape: 0, rmse: 0 })

  useEffect(() => {
    if (!resource || !resourceType) {
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch historical data from Supabase
        const tableName = resourceType === "material" ? "material_history" : "labor_history"
        const { data: historyData, error: historyError } = await supabase
          .from(tableName)
          .select("*")
          .eq(resourceType === "material" ? "material" : "labor", resource)
          .order("created_at", { ascending: true })

        if (historyError) {
          console.error(`Error fetching ${resourceType} history`, historyError)
          setIsLoading(false)
          return
        }

        // Fetch forecast data from API
        const targetDateInMonths = 6
        const params = new URLSearchParams({
          type: resourceType.toLowerCase(),
          name: resource,
          steps: targetDateInMonths.toString(),
        })

        const forecastResponse = await fetch(`https://sdg-arima-python.onrender.com/predict?${params}`)
        const forecastData = await forecastResponse.json()

        // Calculate metrics
        const mape = calculateMAPE(historyData, forecastData)
        const rmse = calculateRMSE(historyData, forecastData)
        setMetrics({ mape, rmse })

        // Prepare chart data
        const combinedData = prepareChartData(historyData, forecastData)
        setChartData(combinedData)
      } catch (error) {
        console.error("Error fetching data for chart:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [resource, resourceType])

  const calculateMAPE = (historyData: any[], forecastData: any) => {
    if (!historyData.length || !forecastData.forecast) return 0

    // Use the last few historical points that overlap with the forecast
    const lastHistoricalPoints = historyData.slice(-forecastData.forecast.length)
    let totalError = 0
    let count = 0

    lastHistoricalPoints.forEach((item, index) => {
      if (index < forecastData.forecast.length) {
        const actual = item.cost
        const forecast = forecastData.forecast[index]
        if (actual !== 0) {
          totalError += Math.abs((actual - forecast) / actual) * 100
          count++
        }
      }
    })

    return count > 0 ? totalError / count : 0
  }

  const calculateRMSE = (historyData: any[], forecastData: any) => {
    if (!historyData.length || !forecastData.forecast) return 0

    const lastHistoricalPoints = historyData.slice(-forecastData.forecast.length)
    let sumSquaredErrors = 0
    let count = 0

    lastHistoricalPoints.forEach((item, index) => {
      if (index < forecastData.forecast.length) {
        const actual = item.cost
        const forecast = forecastData.forecast[index]
        sumSquaredErrors += Math.pow(actual - forecast, 2)
        count++
      }
    })

    return count > 0 ? Math.sqrt(sumSquaredErrors / count) : 0
  }

  const prepareChartData = (historyData: any[], forecastData: any) => {
    const combined = []

    // Process historical data
    for (const item of historyData) {
      const date = new Date(item.created_at)
      combined.push({
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        historical: item.cost,
        forecast: null,
      })
    }

    // Get the last date from historical data
    let lastDate = historyData.length > 0 ? new Date(historyData[historyData.length - 1].created_at) : new Date()

    // Add forecast data
    if (forecastData && forecastData.forecast) {
      for (let i = 0; i < forecastData.forecast.length; i++) {
        // Move to next month
        lastDate = new Date(lastDate)
        lastDate.setMonth(lastDate.getMonth() + 1)

        combined.push({
          date: lastDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          historical: null,
          forecast: forecastData.forecast[i],
        })
      }
    }

    return combined
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forecast Accuracy</CardTitle>
          <CardDescription>Loading forecast data...</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-32 bg-muted rounded mb-2"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Forecast Accuracy</CardTitle>
          <CardDescription>Historical vs predicted prices for {resource}</CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onViewAccuracyDetails}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* <div className="flex flex-col p-3 border rounded-md">
            <div className="text-sm text-muted-foreground flex items-center">
              <span>MAPE</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground/70" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Mean Absolute Percentage Error. Lower is better.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-xl font-semibold mt-1">{metrics.mape.toFixed(2)}%</div>
          </div>
          <div className="flex flex-col p-3 border rounded-md">
            <div className="text-sm text-muted-foreground flex items-center">
              <span>RMSE</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground/70" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Root Mean Square Error. Lower is better.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-xl font-semibold mt-1">₱{metrics.rmse.toFixed(2)}</div>
          </div> */}
        </div>

        <div className="h-[300px]">
          <ChartContainer>
            {chartType === "line" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(value) => `₱${value}`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent label="" payload={[]} />} />
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Legend />
              </LineChart>
            ) : (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                {/* <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} /> */}
                <YAxis
                  tickFormatter={(value) => `₱${value}`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent label="" payload={[]} />} />
                <Area
                  type="monotone"
                  dataKey="historical"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Legend />
              </AreaChart>
            )}
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}