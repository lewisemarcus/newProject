window.onload = function () {
    container = document.getElementById('popup')
    content = document.getElementById('popup-content')

    map = generateMap()

    fetch("https://ipapi.co/json/").then(response => {
        return response.json()
    }).then(data => {
        let lat = data["latitude"], lon = data["longitude"]
        city = data.city ?? "Unnamed"
        zip = data.postal ?? "00000"

        if (lat && lon) {
            goToCoord(lon, lat, drawGrid)
            // waitForCond({animating: true}, "animating", getMapState, false).then(drawGrid)
        }
        
    }).catch(error => {
        let lat = 34.07440, lon = -117.40499
        zip = "90210"
        city = "Beverley Hills"
        goToCoord(lon, lat, drawGrid)
    })
}
