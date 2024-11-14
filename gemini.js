const { MyGeotabSDK } = require('mg-api-js');

// Replace with your MyGeotab credentials
const username = "<YOUR_USERNAME>";
const password = "<YOUR_PASSWORD>";

// Update with your MyGeotab server URL
const baseUrl = "https://<your_server>.mygeotab.com";

async function downloadVehicleData() {
    try {
        // Create a MyGeotab SDK instance
        const sdk = new MyGeotabSDK({ username, password, baseUrl });

        // Get all vehicles
        const vehicles = await sdk.get("/search?search=type:vehicle");

        // Loop through each vehicle
        for (const vehicle of vehicles) {
            const vehicleId = vehicle.id;
            const fileName = `${vehicleId}.csv`;

            // Check if file already exists
            if (!fs.existsSync(fileName)) {
                // Create header row for CSV
                fs.writeFileSync(fileName, "ID,Timestamp,VIN,Latitude,Longitude,Odometer\n");
            }

            // Download latest data for the vehicle
            const data = await sdk.get(`/device/${vehicle.electronicOrderId}/statusdata`);

            // Extract relevant data
            const formattedData = data.map(item => {
                return `${vehicleId},${item.dateTime},${item.vehicleIdentificationNumber},${item.latitude},${item.longitude},${item.odometer}`;
            });

            // Append data to the CSV file
            fs.appendFileSync(fileName, formattedData.join("\n") + "\n");

            console.log(`Downloaded data for vehicle: ${vehicleId}`);
        }
    } catch (error) {
        console.error("Error downloading data:", error);
    }
}

// Import file system module (Node.js built-in)
const fs = require('fs');

// Download vehicle data
downloadVehicleData();