"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Types
type Tool = "brush" | "eraser" | "rectangle" | "circle" | "line"
type Layer = {
  id: string
  name: string
  visible: boolean
  canvas: HTMLCanvasElement | null
  zIndex: number
}
type HistoryItem = {
  layerId: string
  imageData: ImageData
}

export default function DrawingApp() {
  // Canvas and context refs
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const activeCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeCtxRef = useRef<CanvasRenderingContext2D | null>(null)

  // State
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>("brush")
  const [color, setColor] = useState("#000000")
  const [brushSize, setBrushSize] = useState(5)
  const [layers, setLayers] = useState<Layer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string>("")
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [showLanding, setShowLanding] = useState(true)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [redoStack, setRedoStack] = useState<HistoryItem[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [showLayersPanel, setShowLayersPanel] = useState(false)

  // Color palette
  const colorPalette = [
    "#000000",
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
    "#FFA500",
    "#800080",
    "#008000",
    "#800000",
    "#008080",
    "#000080",
    "#FFC0CB",
  ]

  // Initialize canvas and first layer
  useEffect(() => {
    if (canvasContainerRef.current) {
      // Set canvas size based on container
      const containerWidth = Math.min(canvasContainerRef.current.clientWidth - 40, 800)
      const containerHeight = Math.min(window.innerHeight - 300, 600)

      setCanvasSize({
        width: containerWidth,
        height: containerHeight,
      })

      // Create first layer
      const firstLayerId = "layer-" + Date.now()
      const newLayer: Layer = {
        id: firstLayerId,
        name: "Layer 1",
        visible: true,
        canvas: null,
        zIndex: 0,
      }

      setLayers([newLayer])
      setActiveLayerId(firstLayerId)
    }
  }, [])

  // Setup active canvas when layers change
  useEffect(() => {
    if (!activeLayerId || layers.length === 0) return

    const activeLayer = layers.find((layer) => layer.id === activeLayerId)
    if (!activeLayer) return

    if (!activeLayer.canvas) {
      const newCanvas = document.createElement("canvas")
      newCanvas.width = canvasSize.width
      newCanvas.height = canvasSize.height

      const updatedLayers = layers.map((layer) => {
        if (layer.id === activeLayerId) {
          return { ...layer, canvas: newCanvas }
        }
        return layer
      })

      setLayers(updatedLayers)
      activeCanvasRef.current = newCanvas
      activeCtxRef.current = newCanvas.getContext("2d")

      if (activeCtxRef.current) {
        activeCtxRef.current.lineCap = "round"
        activeCtxRef.current.lineJoin = "round"
      }
    } else {
      activeCanvasRef.current = activeLayer.canvas
      activeCtxRef.current = activeLayer.canvas.getContext("2d")
    }
  }, [layers, activeLayerId, canvasSize])

  // Save current state to history before drawing
  const saveToHistory = () => {
    if (!activeCanvasRef.current || !activeCtxRef.current) return

    const imageData = activeCtxRef.current.getImageData(0, 0, canvasSize.width, canvasSize.height)

    setHistory((prev) => [...prev, { layerId: activeLayerId, imageData }])
    setRedoStack([])
  }

  // Undo last action
  const handleUndo = () => {
    if (history.length === 0) return

    const lastItem = history[history.length - 1]
    const newHistory = history.slice(0, -1)

    // Save current state to redo stack
    if (activeCanvasRef.current && activeCtxRef.current) {
      const currentImageData = activeCtxRef.current.getImageData(0, 0, canvasSize.width, canvasSize.height)

      setRedoStack((prev) => [...prev, { layerId: activeLayerId, imageData: currentImageData }])
    }

    // Find the layer to update
    const layerToUpdate = layers.find((layer) => layer.id === lastItem.layerId)
    if (layerToUpdate && layerToUpdate.canvas) {
      const ctx = layerToUpdate.canvas.getContext("2d")
      if (ctx) {
        ctx.putImageData(lastItem.imageData, 0, 0)
        setHistory(newHistory)

        // If we're undoing on a different layer, switch to that layer
        if (activeLayerId !== lastItem.layerId) {
          setActiveLayerId(lastItem.layerId)
        }
      }
    }
  }

  // Redo last undone action
  const handleRedo = () => {
    if (redoStack.length === 0) return

    const lastItem = redoStack[redoStack.length - 1]
    const newRedoStack = redoStack.slice(0, -1)

    // Save current state to history
    if (activeCanvasRef.current && activeCtxRef.current) {
      const currentImageData = activeCtxRef.current.getImageData(0, 0, canvasSize.width, canvasSize.height)

      setHistory((prev) => [...prev, { layerId: activeLayerId, imageData: currentImageData }])
    }

    // Find the layer to update
    const layerToUpdate = layers.find((layer) => layer.id === lastItem.layerId)
    if (layerToUpdate && layerToUpdate.canvas) {
      const ctx = layerToUpdate.canvas.getContext("2d")
      if (ctx) {
        ctx.putImageData(lastItem.imageData, 0, 0)
        setRedoStack(newRedoStack)

        // If we're redoing on a different layer, switch to that layer
        if (activeLayerId !== lastItem.layerId) {
          setActiveLayerId(lastItem.layerId)
        }
      }
    }
  }

  // Clear canvas
  const handleClearCanvas = () => {
    if (!activeCanvasRef.current || !activeCtxRef.current) return

    saveToHistory()

    activeCtxRef.current.clearRect(0, 0, canvasSize.width, canvasSize.height)
  }

  // Start drawing
  const startDrawing = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!activeCtxRef.current) return

    saveToHistory()
    setIsDrawing(true)

    const { offsetX, offsetY } = getCoordinates(e)
    setStartPos({ x: offsetX, y: offsetY })

    if (tool === "brush" || tool === "eraser") {
      activeCtxRef.current.beginPath()
      activeCtxRef.current.moveTo(offsetX, offsetY)

      // Set styles based on tool
      if (tool === "brush") {
        activeCtxRef.current.strokeStyle = color
        activeCtxRef.current.lineWidth = brushSize
      } else if (tool === "eraser") {
        activeCtxRef.current.strokeStyle = "#FFFFFF"
        activeCtxRef.current.lineWidth = brushSize
      }
    }
  }

  // Draw
  const draw = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing || !activeCtxRef.current) return

    const { offsetX, offsetY } = getCoordinates(e)

    if (tool === "brush" || tool === "eraser") {
      activeCtxRef.current.lineTo(offsetX, offsetY)
      activeCtxRef.current.stroke()
    } else if (tool === "rectangle" || tool === "circle" || tool === "line") {
      // For shape tools, we'll preview the shape during mouse move
      const ctx = activeCtxRef.current

      // Clear the canvas and redraw from history
      if (history.length > 0) {
        const lastState = history[history.length - 1]
        if (lastState.layerId === activeLayerId) {
          ctx.putImageData(lastState.imageData, 0, 0)
        }
      } else {
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
      }

      // Set styles
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize

      // Draw the shape
      if (tool === "rectangle") {
        const width = offsetX - startPos.x
        const height = offsetY - startPos.y
        ctx.strokeRect(startPos.x, startPos.y, width, height)
      } else if (tool === "circle") {
        const radius = Math.sqrt(Math.pow(offsetX - startPos.x, 2) + Math.pow(offsetY - startPos.y, 2))
        ctx.beginPath()
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI)
        ctx.stroke()
      } else if (tool === "line") {
        ctx.beginPath()
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(offsetX, offsetY)
        ctx.stroke()
      }
    }
  }

  // Stop drawing
  const stopDrawing = () => {
    if (!isDrawing || !activeCtxRef.current) return

    if (tool === "brush" || tool === "eraser") {
      activeCtxRef.current.closePath()
    }

    setIsDrawing(false)
  }

  // Get coordinates from mouse or touch event
  const getCoordinates = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    let offsetX, offsetY

    if ("touches" in e) {
      // Touch event
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      offsetX = e.touches[0].clientX - rect.left
      offsetY = e.touches[0].clientY - rect.top
    } else {
      // Mouse event
      offsetX = e.nativeEvent.offsetX
      offsetY = e.nativeEvent.offsetY
    }

    return { offsetX, offsetY }
  }

  // Add new layer
  const addLayer = () => {
    const newLayerId = "layer-" + Date.now()
    const newLayerName = `Layer ${layers.length + 1}`

    const newCanvas = document.createElement("canvas")
    newCanvas.width = canvasSize.width
    newCanvas.height = canvasSize.height

    const newLayer: Layer = {
      id: newLayerId,
      name: newLayerName,
      visible: true,
      canvas: newCanvas,
      zIndex: layers.length,
    }

    setLayers((prev) => [...prev, newLayer])
    setActiveLayerId(newLayerId)
  }

  // Toggle layer visibility
  const toggleLayerVisibility = (layerId: string) => {
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? { ...layer, visible: !layer.visible } : layer)))
  }

  // Delete layer
  const deleteLayer = (layerId: string) => {
    // Don't delete if it's the only layer
    if (layers.length <= 1) return

    const updatedLayers = layers.filter((layer) => layer.id !== layerId)
    setLayers(updatedLayers)

    // If we deleted the active layer, set a new active layer
    if (layerId === activeLayerId && updatedLayers.length > 0) {
      setActiveLayerId(updatedLayers[0].id)
    }
  }

  // Rename layer
  const renameLayer = (layerId: string, newName: string) => {
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? { ...layer, name: newName } : layer)))
  }

  // Save canvas as image
  const saveAsImage = () => {
    // Create a temporary canvas to merge all visible layers
    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvasSize.width
    tempCanvas.height = canvasSize.height
    const tempCtx = tempCanvas.getContext("2d")

    if (!tempCtx) return

    // Draw white background
    tempCtx.fillStyle = "#FFFFFF"
    tempCtx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    // Sort layers by z-index and draw visible ones
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex)

    sortedLayers.forEach((layer) => {
      if (layer.visible && layer.canvas) {
        tempCtx.drawImage(layer.canvas, 0, 0)
      }
    })

    // Create download link
    const link = document.createElement("a")
    link.download = "drawing.png"
    link.href = tempCanvas.toDataURL("image/png")
    link.click()
  }

  // Render canvas layers
  const renderCanvasLayers = () => {
    return layers.map((layer) => {
      if (!layer.canvas || !layer.visible) return null

      return (
        <div
          key={layer.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: layer.zIndex,
            display: layer.visible ? "block" : "none",
          }}
        >
          <canvas
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ display: "block" }}
            ref={layer.id === activeLayerId ? activeCanvasRef : null}
          />
        </div>
      )
    })
  }

  // Landing screen component
  const LandingScreen = () => (
    <motion.div
      className="fixed inset-0 bg-gradient-to-br from-purple-700 to-indigo-900 flex flex-col items-center justify-center z-50"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">Canvas Studio</h1>
        <p className="text-xl text-purple-200 mb-10 max-w-md mx-auto">
          Create stunning digital artwork with our professional drawing tools
        </p>

        <motion.div
          className="flex flex-wrap justify-center gap-8 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white text-center w-40">
            <svg className="w-10 h-10 mx-auto mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 10C20 13.3137 16.4183 16 12 16C7.58172 16 4 13.3137 4 10C4 6.68629 7.58172 4 12 4C16.4183 4 20 6.68629 20 10Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M12 16V20" stroke="currentColor" strokeWidth="2" />
              <path d="M17 13L19 17" stroke="currentColor" strokeWidth="2" />
              <path d="M7 13L5 17" stroke="currentColor" strokeWidth="2" />
            </svg>
            <h3 className="font-medium">Color Tools</h3>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white text-center w-40">
            <svg className="w-10 h-10 mx-auto mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            </svg>
            <h3 className="font-medium">Shape Drawing</h3>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white text-center w-40">
            <svg className="w-10 h-10 mx-auto mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19H20" stroke="currentColor" strokeWidth="2" />
              <path d="M4 15H20" stroke="currentColor" strokeWidth="2" />
              <path d="M4 11H20" stroke="currentColor" strokeWidth="2" />
              <path d="M4 7H20" stroke="currentColor" strokeWidth="2" />
            </svg>
            <h3 className="font-medium">Layer System</h3>
          </div>
        </motion.div>

        <motion.button
          className="px-8 py-3 bg-white text-purple-700 rounded-full font-medium text-lg shadow-lg hover:bg-purple-50 transition-colors"
          onClick={() => setShowLanding(false)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start Drawing
        </motion.button>
      </motion.div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence>{showLanding && <LandingScreen />}</AnimatePresence>

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center mr-3"
              whileHover={{ rotate: 5 }}
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 17L9 11L13 15L21 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 7H21V11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            <h1 className="text-xl font-bold text-gray-800">Canvas Studio</h1>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              className="px-4 py-2 bg-purple-600 text-white rounded-md font-medium flex items-center"
              onClick={saveAsImage}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 17V19C4 19.5304 4.21071 20.0391 4.58579 20.4142C4.96086 20.7893 5.46957 21 6 21H18C18.5304 21 19.0391 20.7893 19.4142 20.4142C19.7893 20.0391 20 19.5304 20 19V17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 11L12 16L17 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M12 4V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save Image
            </motion.button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tools Panel */}
          <div className="lg:w-64 bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Tools</h2>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <motion.button
                className={`p-2 rounded-md flex flex-col items-center justify-center ${tool === "brush" ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100"}`}
                onClick={() => setTool("brush")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M20 8L16 4L4 16L8 20L20 8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18 10L14 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 16L3 21L8 20L4 16Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs">Brush</span>
              </motion.button>

              <motion.button
                className={`p-2 rounded-md flex flex-col items-center justify-center ${tool === "eraser" ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100"}`}
                onClick={() => setTool("eraser")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 13L11 20L4 13L11 6L18 13Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 20H11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs">Eraser</span>
              </motion.button>

              <motion.button
                className={`p-2 rounded-md flex flex-col items-center justify-center ${tool === "rectangle" ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100"}`}
                onClick={() => setTool("rectangle")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-xs">Rectangle</span>
              </motion.button>

              <motion.button
                className={`p-2 rounded-md flex flex-col items-center justify-center ${tool === "circle" ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100"}`}
                onClick={() => setTool("circle")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="text-xs">Circle</span>
              </motion.button>

              <motion.button
                className={`p-2 rounded-md flex flex-col items-center justify-center ${tool === "line" ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100"}`}
                onClick={() => setTool("line")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M5 19L19 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs">Line</span>
              </motion.button>

              <motion.button
                className="p-2 rounded-md flex flex-col items-center justify-center hover:bg-gray-100"
                onClick={handleClearCanvas}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 6H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 10V16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 10V16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 6L6 18C6 18.5304 6.21071 19.0391 6.58579 19.4142C6.96086 19.7893 7.46957 20 8 20H16C16.5304 20 17.0391 19.7893 17.4142 19.4142C17.7893 19.0391 18 18.5304 18 18L19 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 6V4C9 3.73478 9.10536 3.48043 9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C14.2652 3 14.5196 3.10536 14.7071 3.29289C14.8946 3.48043 15 3.73478 15 4V6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-xs">Clear</span>
              </motion.button>
            </div>

            {/* Color Picker */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-700">Color</h3>
                <div
                  className="w-8 h-8 rounded-full border border-gray-300 cursor-pointer"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                ></div>
              </div>

              {showColorPicker && (
                <motion.div
                  className="grid grid-cols-5 gap-2 p-2 bg-white rounded-md shadow-md"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {colorPalette.map((c) => (
                    <div
                      key={c}
                      className="w-8 h-8 rounded-full cursor-pointer border border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setColor(c)
                        setShowColorPicker(false)
                      }}
                    ></div>
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 cursor-pointer"
                  />
                </motion.div>
              )}
            </div>

            {/* Brush Size */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Brush Size</h3>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">1</span>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number.parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-500 ml-2">50</span>
              </div>
              <div className="mt-2 flex justify-center">
                <div
                  className="rounded-full bg-black"
                  style={{
                    width: `${brushSize}px`,
                    height: `${brushSize}px`,
                    backgroundColor: color,
                  }}
                ></div>
              </div>
            </div>

            {/* History Controls */}
            <div className="flex space-x-2 mb-6">
              <motion.button
                className="flex-1 py-2 px-3 bg-gray-100 rounded-md text-gray-700 font-medium flex items-center justify-center disabled:opacity-50"
                onClick={handleUndo}
                disabled={history.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 14L4 9L9 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 9H15C18.3137 9 21 11.6863 21 15C21 18.3137 18.3137 21 15 21H10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Undo
              </motion.button>

              <motion.button
                className="flex-1 py-2 px-3 bg-gray-100 rounded-md text-gray-700 font-medium flex items-center justify-center disabled:opacity-50"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M15 14L20 9L15 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 9H9C5.68629 9 3 11.6863 3 15C3 18.3137 5.68629 21 9 21H14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Redo
              </motion.button>
            </div>

            {/* Layers Button */}
            <motion.button
              className="w-full py-2 px-3 bg-purple-600 text-white rounded-md font-medium flex items-center justify-center"
              onClick={() => setShowLayersPanel(!showLayersPanel)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Manage Layers
            </motion.button>
          </div>

          {/* Canvas Container */}
          <div className="flex-1">
            <div ref={canvasContainerRef} className="bg-white rounded-lg shadow-sm p-4 mb-4 overflow-hidden">
              <div
                className="relative bg-white border border-gray-200 mx-auto"
                style={{
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              >
                {renderCanvasLayers()}
              </div>
            </div>

            {/* Canvas Info */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-medium text-gray-800 mb-2">Canvas Info</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Dimensions</p>
                  <p className="font-medium">
                    {canvasSize.width} x {canvasSize.height}px
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Layer</p>
                  <p className="font-medium">{layers.find((l) => l.id === activeLayerId)?.name || "None"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Tool</p>
                  <p className="font-medium capitalize">{tool}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Brush Size</p>
                  <p className="font-medium">{brushSize}px</p>
                </div>
              </div>
            </div>
          </div>

          {/* Layers Panel (Slide-in) */}
          <AnimatePresence>
            {showLayersPanel && (
              <motion.div
                className="fixed inset-y-0 right-0 w-80 bg-white shadow-lg z-40 overflow-y-auto"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25 }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">Layers</h2>
                    <button className="p-1 rounded-full hover:bg-gray-100" onClick={() => setShowLayersPanel(false)}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 6L18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <motion.button
                    className="w-full py-2 px-3 bg-purple-600 text-white rounded-md font-medium flex items-center justify-center mb-4"
                    onClick={addLayer}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 5V19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Add New Layer
                  </motion.button>

                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <motion.div
                        key={layer.id}
                        className={`p-3 rounded-md border ${layer.id === activeLayerId ? "border-purple-500 bg-purple-50" : "border-gray-200"}`}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <button
                              className="p-1 rounded-full hover:bg-gray-200 mr-2"
                              onClick={() => toggleLayerVisibility(layer.id)}
                            >
                              {layer.visible ? (
                                <svg
                                  className="w-5 h-5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-5 h-5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M9.9 4.24C10.5883 4.0781 11.2931 3.99875 12 4C19 4 23 12 23 12C22.393 13.1356 21.6691 14.2047 20.84 15.19M14.12 14.12C13.8454 14.4147 13.5141 14.6512 13.1462 14.8151C12.7782 14.9791 12.3809 15.0673 11.9781 15.0744C11.5753 15.0815 11.1752 15.0074 10.8016 14.8565C10.4281 14.7056 10.0887 14.4811 9.80385 14.1962C9.51897 13.9113 9.29439 13.572 9.14351 13.1984C8.99262 12.8249 8.91853 12.4247 8.92563 12.0219C8.93274 11.6191 9.02091 11.2219 9.18488 10.8539C9.34884 10.4859 9.58525 10.1547 9.88 9.88M1 1L23 23M17.94 17.94C16.2306 19.243 14.1491 19.9649 12 20C5 20 1 12 1 12C2.24389 9.68192 3.96914 7.65663 6.06 6.06L17.94 17.94Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                            <span className="font-medium cursor-pointer" onClick={() => setActiveLayerId(layer.id)}>
                              {layer.name}
                            </span>
                          </div>

                          <div className="flex items-center">
                            <button
                              className="p-1 rounded-full hover:bg-gray-200 mr-1"
                              onClick={() => {
                                const newName = prompt("Enter new layer name:", layer.name)
                                if (newName) renameLayer(layer.id, newName)
                              }}
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>

                            <button
                              className="p-1 rounded-full hover:bg-gray-200"
                              onClick={() => deleteLayer(layer.id)}
                              disabled={layers.length <= 1}
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M3 6H5H21"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
