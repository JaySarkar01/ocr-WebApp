"use client";

import Image from "next/image";
import { useState, useCallback, useRef } from "react";
import { createWorker } from "tesseract.js";
import { FiUpload, FiCopy, FiCheck, FiX, FiLoader, FiDownload, FiRefreshCw } from "react-icons/fi";

export default function ImageTextExtractor() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [extractedFields, setExtractedFields] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  // Handle file selection
  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size should be less than 10MB');
      return;
    }

    setSelectedImage(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset previous results
    setExtractedText("");
    setProgress(0);
    setExtractedFields({});
    setCopySuccess(false);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      handleFile(event.target.files[0]);
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview("");
    setExtractedText("");
    setExtractedFields({});
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Extract text from image
  const extractText = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setExtractedText("");
    setExtractedFields({});

    try {
      // Create Tesseract worker with optimized settings
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Perform OCR
      const {
        data: { text },
      } = await worker.recognize(selectedImage);

      // Define the important fields we want to extract
      const importantFields = [
        { key: "Model Name", patterns: ["model name", "model", "product"] },
        { key: "Model Number", patterns: ["model number", "model no", "part number", "p/n"] },
        { key: "Serial Number", patterns: ["serial number", "serial no", "s/n", "sn"] }
      ];

      // Split the extracted text into lines and clean them
      const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Function to extract field value with improved pattern matching
      function extractFieldValue(fieldConfig: typeof importantFields[0], lines: string[]) {
        for (const line of lines) {
          const lineLower = line.toLowerCase();
          
          for (const pattern of fieldConfig.patterns) {
            if (lineLower.includes(pattern)) {
              // Extract value after the pattern
              const value = line
                .replace(new RegExp(pattern, "gi"), "")
                .replace(/[:=\-|]/g, "")
                .trim();
              
              // If value is empty, try to get next line
              if (!value) {
                const lineIndex = lines.indexOf(line);
                if (lineIndex < lines.length - 1) {
                  return lines[lineIndex + 1].trim();
                }
              }
              
              return value || "Not found";
            }
          }
        }
        return "Not found";
      }

      // Build structured result
      const fields: Record<string, string> = {};
      importantFields.forEach((field) => {
        fields[field.key] = extractFieldValue(field, lines);
      });

      setExtractedFields(fields);
      
      // Also keep the full text for reference
      const fullText = importantFields
        .map(field => `${field.key}: ${fields[field.key]}`)
        .join('\n');
      
      setExtractedText(fullText);

      // Terminate worker
      await worker.terminate();
    } catch (error) {
      console.error("Error extracting text:", error);
      setExtractedText("Error occurred while extracting text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy text to clipboard with feedback
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert('Failed to copy text');
    }
  };

  // Download extracted text as file
  const downloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Image Text Extractor
          </h1>
          <p className="text-gray-600">
            Upload an image to extract text using OCR technology
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-blue-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="text-center">
              <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drag & drop an image here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Supports JPG, PNG, GIF (max 10MB)
              </p>
            </div>
          </div>

          {/* Image Preview Section */}
          {imagePreview && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Selected Image
                </h2>
                <button
                  onClick={clearImage}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Clear image"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <div className="relative aspect-video">
                  <Image
                    src={imagePreview}
                    alt="Selected preview"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={extractText}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    isProcessing
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <FiLoader className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiRefreshCw />
                      Extract Text
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div className="mt-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Processing image...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                Extracting text from image, please wait...
              </p>
            </div>
          )}

          {/* Extracted Results */}
          {extractedText && (
            <div className="mt-8">
              <div className="border rounded-xl overflow-hidden">
                {/* Results Header */}
                <div className="bg-gray-50 px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Extracted Information
                  </h2>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        copySuccess
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      {copySuccess ? (
                        <>
                          <FiCheck className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <FiCopy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={downloadText}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                    >
                      <FiDownload className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>

                {/* Structured Results */}
                {Object.keys(extractedFields).length > 0 && (
                  <div className="bg-white p-6 border-b">
                    <div className="grid gap-4">
                      {Object.entries(extractedFields).map(([key, value]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center">
                          <span className="text-sm font-medium text-gray-500 sm:w-32">
                            {key}:
                          </span>
                          <span className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded flex-1">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Text Area */}
                <textarea
                  value={extractedText}
                  readOnly
                  rows={8}
                  className="w-full p-4 font-mono text-sm bg-gray-50 focus:outline-none resize-y"
                  placeholder="Extracted text will appear here..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Powered by Tesseract.js OCR Engine
        </div>
      </div>
    </div>
  );
}