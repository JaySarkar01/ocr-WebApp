"use client";

import Image from "next/image";
import { useState } from "react";
import { createWorker } from "tesseract.js";

export default function ImageTextExtractor() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Handle image selection
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
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
    }
  };

  // Extract text from image
  const extractText = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setExtractedText("");

    try {
      // Create Tesseract worker
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          console.log(m);
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
      const impData = ["Model Name", "Model Number", "Serial Number"];

      // Split the extracted text into lines and remove empty lines
      const extractedInfo = text
        .split("\n")
        .filter((line) => line.trim() !== "");

      // Function to search for a keyword and return only its value
      function searchStringInArray(keyword: string, lines: string[]) {
        for (let j = 0; j < lines.length; j++) {
          if (lines[j].toLowerCase().includes(keyword.toLowerCase())) {
            const value = lines[j]
              .replace(new RegExp(keyword, "gi"), "")
              .replace(/[:]/g, "")
              .trim();
            return value || "Not found";
          }
        }
        return "Not found";
      }

      // Build result with ONLY values (no field names)
      let result = "";
      impData.forEach((keyword) => {
        const value = searchStringInArray(keyword, extractedInfo);
        result += `${value}\n`; // ← ONLY the value, no "keyword:" prefix
      });

      // Set the extracted and parsed text
      setExtractedText(result || text);

      // Terminate worker
      await worker.terminate();
    } catch (error) {
      console.error("Error extracting text:", error);
      setExtractedText("Error occurred while extracting text.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    alert("Text copied to clipboard!");
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Image Text Extractor</h1>

      {/* Upload Section */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold">
          Upload Image or Screenshot:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Selected Image:</h2>
          <div className="relative w-full max-w-md border rounded">
            <Image
              src={imagePreview}
              alt="Selected"
              width={500}
              height={300}
              className="object-contain rounded"
            />
          </div>
        </div>
      )}

      {/* Extract Button */}
      {selectedImage && !isProcessing && (
        <button
          onClick={extractText}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 mb-6"
        >
          Extract Text
        </button>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded h-4">
            <div
              className="bg-blue-600 h-4 rounded transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center mt-2">Processing: {progress}%</p>
        </div>
      )}

      {/* Extracted Text Result */}
      {extractedText && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Extracted Text:</h2>
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Copy Text
            </button>
          </div>
          <textarea
            value={extractedText}
            readOnly
            rows={10}
            className="w-full p-4 border rounded bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}
