// Arduino Example Code for Waste Data Submission
// Simplified API - Date is automatically handled by the server

const examples = {
  
  // Example 1: Basic daily submission (what Arduino should send)
  basicSubmission: {
    endpoint: 'POST /api/waste/add',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      recyclable: 25,
      biodegradable: 18,
      nonBiodegradable: 12
      // NOTE: No date parameter needed - server automatically uses today's date
    }
  },

  // Example 2: Expected successful response for new record
  successResponseNew: {
    status: 201,
    body: {
      success: true,
      message: 'Daily waste record created successfully',
      action: 'created',
      data: {
        id: 21,
        date: '2025-09-30T00:00:00.000Z',
        recyclable: 25,
        biodegradable: 18,
        nonBiodegradable: 12,
        total: 55,
        createdAt: '2025-09-30T15:30:45.123Z'
      }
    }
  },

  // Example 3: Expected response when updating existing record (multiple submissions same day)
  successResponseUpdated: {
    status: 200,
    body: {
      success: true,
      message: 'Daily waste record updated successfully',
      action: 'updated',
      data: {
        id: 21,
        date: '2025-09-30T00:00:00.000Z',
        recyclable: 45, // Previous 25 + new 20
        biodegradable: 28, // Previous 18 + new 10
        nonBiodegradable: 20, // Previous 12 + new 8
        total: 93,
        previousValues: {
          recyclable: 25,
          biodegradable: 18,
          nonBiodegradable: 12
        },
        addedValues: {
          recyclable: 20,
          biodegradable: 10,
          nonBiodegradable: 8
        },
        updatedAt: '2025-09-30T16:45:30.456Z'
      }
    }
  },

  // Example 4: Error response for duplicate date
  duplicateErrorResponse: {
    status: 409,
    body: {
      success: false,
      message: 'A waste record for today already exists. Records cannot be updated once created.',
      error: 'RECORD_ALREADY_EXISTS',
      existingRecord: {
        id: 15,
        date: '2025-10-01T00:00:00.000Z',
        recyclable: 30,
        biodegradable: 20,
        nonBiodegradable: 15,
        total: 65,
        createdAt: '2025-10-01T08:30:00.000Z'
      }
    }
  },

  // Example 5: Error response for missing data
  validationErrorResponse: {
    status: 400,
    body: {
      success: false,
      message: 'Missing required fields. Please provide recyclable, biodegradable, and nonBiodegradable amounts.',
      required: ['recyclable', 'biodegradable', 'nonBiodegradable']
    }
  }
};

// Arduino C++ Code Example (Simplified):
const arduinoCodeExample = `
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";
const char* serverURL = "http://your-server.com/api/waste/add";

// Sensor readings (replace with actual sensor data)
int recyclableAmount = 0;
int biodegradableAmount = 0;
int nonBiodegradableAmount = 0;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
  
  // Initialize sensors here
  initializeSensors();
}

void sendWasteData() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload (simplified - no date needed)
    StaticJsonDocument<200> doc;
    doc["recyclable"] = recyclableAmount;
    doc["biodegradable"] = biodegradableAmount;
    doc["nonBiodegradable"] = nonBiodegradableAmount;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    Serial.println("Sending data: " + jsonString);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response Code: " + String(httpResponseCode));
      Serial.println("Response: " + response);
      
      // Parse response to check success
      StaticJsonDocument<500> responseDoc;
      deserializeJson(responseDoc, response);
      
      if (responseDoc["success"] == true) {
        String action = responseDoc["action"];
        int total = responseDoc["data"]["total"];
        Serial.println("Success! Action: " + action + ", Total: " + String(total));
        
        // Reset sensor readings after successful submission
        resetSensorReadings();
      } else {
        Serial.println("Error: " + String(responseDoc["message"].as<String>()));
      }
    } else {
      Serial.println("Error in HTTP request: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi disconnected");
  }
}

void readSensors() {
  // Replace with actual sensor reading logic
  recyclableAmount = readRecyclableSensor();
  biodegradableAmount = readBiodegradableSensor();
  nonBiodegradableAmount = readNonBiodegradableSensor();
  
  Serial.println("Sensor readings - R:" + String(recyclableAmount) + 
                 " B:" + String(biodegradableAmount) + 
                 " NB:" + String(nonBiodegradableAmount));
}

void resetSensorReadings() {
  // Reset sensor values after successful submission
  recyclableAmount = 0;
  biodegradableAmount = 0;
  nonBiodegradableAmount = 0;
}

void initializeSensors() {
  // Initialize your sensors here
  Serial.println("Sensors initialized");
}

// Placeholder sensor reading functions
int readRecyclableSensor() {
  // Implement your recyclable waste sensor reading
  return 0; // Replace with actual reading
}

int readBiodegradableSensor() {
  // Implement your biodegradable waste sensor reading
  return 0; // Replace with actual reading
}

int readNonBiodegradableSensor() {
  // Implement your non-biodegradable waste sensor reading
  return 0; // Replace with actual reading
}

void loop() {
  // Read sensors
  readSensors();
  
  // Send data to server (only if there's waste to report)
  if (recyclableAmount > 0 || biodegradableAmount > 0 || nonBiodegradableAmount > 0) {
    sendWasteData();
  }
  
  // Wait before next reading (adjust based on your requirements)
  // For daily reporting: 86400000 ms = 24 hours
  // For testing: 60000 ms = 1 minute
  delay(60000); // 1 minute for testing
}
`;

console.log('📋 Arduino Integration Guide for Waste Management System');
console.log('=' .repeat(60));
console.log('');
console.log('🎯 API Endpoint: POST /api/waste/add');
console.log('📍 Simplified Data Format (NO DATE REQUIRED):');
console.log(JSON.stringify(examples.basicSubmission.body, null, 2));
console.log('');
console.log('✅ Success Response (New Record):');
console.log(JSON.stringify(examples.successResponseNew.body, null, 2));
console.log('');
console.log('✅ Success Response (Updated Record):');
console.log(JSON.stringify(examples.successResponseUpdated.body, null, 2));
console.log('');
console.log('❌ Error Response Example:');
console.log(JSON.stringify(examples.errorResponse.body, null, 2));
console.log('');
console.log('🔧 Complete Arduino C++ Code:');
console.log(arduinoCodeExample);
console.log('');
console.log('📝 Key Changes & Notes:');
console.log('✅ SIMPLIFIED: No date parameter needed - server automatically uses today\'s date');
console.log('✅ AUTOMATIC: Server handles date/time based on server timezone');
console.log('🚫 IMMUTABLE: Records CANNOT be updated once created - one record per day max');
console.log('⚠️  CONFLICT: 409 response if record already exists for today');
console.log('✅ FEEDBACK: Detailed response shows creation success or conflict reason');
console.log('⚠️  IMPORTANT: Arduino should handle 409 by waiting until next day');
console.log('⚠️  TESTING: Use shorter delays (1 minute) for testing, 24 hours for production');

export default examples;