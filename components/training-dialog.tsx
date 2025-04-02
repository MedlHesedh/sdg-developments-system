"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, RefreshCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TrainingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TrainingDialog({ open, onOpenChange }: TrainingDialogProps) {
  const [isTraining, setIsTraining] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<"idle" | "training" | "success" | "error">("idle")
  const [log, setLog] = useState<string[]>([])
  const { toast } = useToast()

  const trainModel = () =>{
    fetch("https://sdg-arima-python.onrender.com/train")
      .then((response) => response.json())
      .then((data) => {
        console.log(data)
      })
      .catch((error) => {
        console.error("Error:", error)
      })


    
    // onOpenChange(false)
  }

  const handleStartTraining = async () => {
    setIsTraining(true)
    setStatus("training")
    setProgress(0)
    trainModel()
    setLog(["Initializing training process..."])

    try {
      // Simulate the training process with progress updates
      const trainingInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(trainingInterval)
            return 100
          }
          return prev + 5
        })
      }, 500)

      // Add log messages during the process
      setTimeout(() => setLog((prev) => [...prev, "Loading historical data from database..."]), 1000)
      setTimeout(() => setLog((prev) => [...prev, "Preprocessing data..."]), 3000)
      setTimeout(() => setLog((prev) => [...prev, "Training ARIMA models for each material..."]), 5000)
      setTimeout(() => setLog((prev) => [...prev, "Optimizing model parameters..."]), 8000)
      setTimeout(() => setLog((prev) => [...prev, "Validating models..."]), 12000)
      setTimeout(() => setLog((prev) => [...prev, "Saving trained models..."]), 15000)

      // Complete the process
      setTimeout(() => {
        clearInterval(trainingInterval)
        setProgress(100)
        setStatus("success")
        setLog((prev) => [...prev, "Training completed successfully!"])
        setIsTraining(false)

        toast({
          title: "Training Complete",
          description: "Models have been successfully trained with the latest data.",
        })
      }, 18000)
    } catch (error) {
      setStatus("error")
      setLog((prev) => [...prev, "Error: Training process failed. Please try again."])
      setIsTraining(false)

      toast({
        title: "Training Failed",
        description: "An error occurred during the training process.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Auto Train Models</DialogTitle>
          <DialogDescription>Train ARIMA forecasting models with the latest data from your database</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {status === "training" && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Training in progress...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {status === "success" && (
            <Alert variant="default" className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Training Complete</AlertTitle>
              <AlertDescription className="text-green-700">
                All models have been successfully trained and are ready to use.
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Training Failed</AlertTitle>
              <AlertDescription>An error occurred during the training process. Please try again.</AlertDescription>
            </Alert>
          )}

          <div className="bg-muted p-3 rounded-md h-48 overflow-y-auto text-sm font-mono">
            {log.map((entry, index) => (
              <div key={index} className="py-1">
                <span className="text-muted-foreground">[{new Date().toLocaleTimeString()}]</span> {entry}
              </div>
            ))}
            {isTraining && (
              <div className="animate-pulse">
                <span className="text-muted-foreground">[{new Date().toLocaleTimeString()}]</span> Processing...
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {status === "idle" || status === "error" ? (
            <Button onClick={handleStartTraining} disabled={isTraining}>
              {isTraining ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Training...
                </>
              ) : (
                "Start Training"
              )}
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

