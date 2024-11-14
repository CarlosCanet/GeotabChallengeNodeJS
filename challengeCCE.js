const authentication = {
    credentials: {
        database: 'demo_candidates_net',
        userName: 'carlos@carlosca.net',
        password: 'JFd3Bz_p4QgLCfYw67JYwxzGRUiYgC_P'
    },
    path: 'mypreview.geotab.com'
}

const GeotabApi = require('mg-api-js');
const api = new GeotabApi(authentication);

var group = {
    id: "GroupCompanyId" // Populated with the desired group id.
},
    results = [];

api.call("Get", { typeName: "Device", search: { "groups": [group] }, resultsLimit: 60 })
    .then(devices => {
        var now = new Date().toISOString(),
            calls = [],
            diagnostic = {
                id: "DiagnosticOdometerId"
            };
        devices.forEach(function (device) {
            results.push({
                name: device.name,
                vehicleIdentificationNumber: device.vehicleIdentificationNumber
            });
            calls.push({
                method: "Get",
                params: {
                    typeName: "StatusData",
                    search: {
                        fromDate: now,
                        toDate: now,
                        diagnosticSearch: diagnostic,
                        deviceSearch: { id: device.id }
                    }
                }
            });
            calls.push({
                method: "Get",
                params: {
                    typeName: "LogRecord",
                    search: {
                        fromDate: now,
                        toDate: now,
                        deviceSearch: {
                            id: device.id
                        }
                    }
                }
            });
        });
        api.call("ExecuteMultiCall", {
            calls: calls
        })
            .then(callResults => {
                var statusData, i;
                for (i = 0; i < callResults.length; i++) {
                    statusData = callResults[i][0];
                    if (statusData) {
                        let pos = Math.floor(i / 2);
                        if (statusData.data) {
                            results[pos].odometer = statusData.data;
                        }
                        if (statusData.longitude) {
                            results[pos].longitude = statusData.longitude;
                            results[pos].latitude = statusData.latitude;
                        }
                    }
                }
                console.log(results);
            })
            .catch(error => {
                console.log(error);
            });
    })
    .catch(error => {
        console.log(error);
    });



function showDeviceLocation(device) {
    api.call("Get", {
        typeName: "DeviceStatusInfo",
        search: {
            deviceSearch: {
                id: device.id
            }
        }
    }, function (result) {
        if (result.length > 0) {
            var location = new L.LatLng(result[0].latitude, result[0].longitude);
            var marker = L.marker(location).bindPopup(
                "<strong>" + device.name + "</strong><br />" +
                location.lat + ", " + location.lng);

            layerGroup.clearLayers().addLayer(marker);
            map.setView(location, 15);
        } else {
            alert("Location information not available for the inputted device")
        }
    }, function (error) {
        alert(error);
    });
}