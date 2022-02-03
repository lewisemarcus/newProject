var view, map, fetched, city, zip, source, js_map, highlighted, old, container, content, closer, overlay, popped, circleRad

const AQkey = "03e6687524e359bbf0987c0f2ede90cb945e4404"
const constRad = 15
const pollTypes = ["pm25", "no2", "co", "so2", "nh3", "o3", "pm10"]
const pollVals = ["PM<sub>2.5</sub> : ", "NO<sub>2</sub> : ", "CO : ", "SO<sub>2</sub> : ", "NH<sub>3</sub> : ", "O<sub>3</sub> : ", "PM<sub>10</sub> : "]

//DOM constiables
const llTitle = document.getElementById("levelsTitle")
const llContent = document.getElementById("levelsContent")
const locZip = document.getElementById("enterZip")
locZip.value = ""
var disp = document.getElementById("disp");

//map buttons
const OK = document.getElementById("ok")
OK.addEventListener("click", changeZip)
const HERE = document.getElementById("here")
HERE.addEventListener("click", changeCoord)

//local storage stuff
var HDISP = document.getElementById("displayedSearches")
var fs = 0//index of first stored element to display
var PREV = document.getElementById("seePrev")
PREV.addEventListener("click", seePrev)
var NEXT = document.getElementById("seeNext")
NEXT.addEventListener("click", seeNext)
var ERASE = document.getElementById("eraseSearches")
ERASE.addEventListener("click", eraseSearches)

if (localStorage.getItem('place7896') == null) {
    var storedSearches = [[], []];
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = "";
        HDISP.children[v].children[1].textContent = "";
    }
    displaySearches(fs)
} else {
    var storedSearches = [JSON.parse(localStorage.place7896), JSON.parse(localStorage.levels7896)];
    displaySearches(fs)
}

function generateMap() {
    view = new ol.View({
        center: ol.proj.fromLonLat([-96.21, 37.46]),
        zoom: 4
    })
    tileLayer = new ol.layer.Tile({
        preload: 4,
        source: new ol.source.OSM()
    })
    source = new ol.source.Vector()
    vector = new ol.layer.Vector({
        source: source,
        updateWhileAnimating: true,
        updateWhileInteracting: true
    })
    overlay = new ol.Overlay({
        element: container,
        autoPan: {
            animation: {
                duration: 250,
            }
        }
    })

    let m = new ol.Map({
        view: view,
        overlays: [overlay],
        layers: [tileLayer, vector],
        target: 'js-map'
    })

    m.on("pointermove", event => {
        if (event.dragging) return
        if (highlighted) {
            highlighted.setStyle(old)
        }
        highlighted = undefined
        const eventPix = map.getEventPixel(event.originalEvent)
        let counter = 0

        map.forEachFeatureAtPixel(eventPix, (feature, layer) => {
            if (!feature) return
            if (highlighted) return
            const col = [170, 211, 223, 1]

            let imgFill = feature.getStyle()

            let colorStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: circleRad,
                    fill: new ol.style.Fill({
                        color: col
                    })
                })
            })

            feature.setStyle(colorStyle)

            feature.setStyle(function (feature, resolution) {
                colorStyle.getImage().setScale(map.getView().getResolutionForZoom(10) / resolution)
                return colorStyle
            })

            let ext = feature.getGeometry().getExtent();
            let coordinate = ol.extent.getCenter(ext)

            popupInfo(coordinate, feature.get("pollutionInfo"))

            old = imgFill
            highlighted = feature
            counter++
        })

        if (!counter) {
            clearPopup()
        }
    })
    return m
}

function popupInfo(pos, info) {
    if (popped) return
    overlay.setPosition(pos)

    content.innerHTML = ""

    for (i = 0; i < info.length; i++) {
        let p = document.createElement("p")
        p.innerHTML = info[i]

        content.appendChild(p)
    }
    popped = true
}

function clearPopup() {
    overlay.setPosition(undefined)
    popped = false
}

function goToCoord(lon, lat, onDone = () => { }) {
    if (map === undefined) {
        return
    }
    view.animate({
        center: ol.proj.fromLonLat([lon, lat]),
        duration: 2000
    })
    view.animate({
        zoom: 10,
        duration: 2000
    }, interrupted => {
        if (!interrupted) {
            view.setCenter(ol.proj.fromLonLat([lon, lat]))
            view.setZoom(8)
            return
        }
        onDone(Array.prototype.slice.call(arguments, 3))
    })

}

function isWater(lon, lat) {
    const blue = [170, 211, 223]

    var xy = map.getPixelFromCoordinate(ol.proj.fromLonLat([lon, lat]))

    var canvasContext = document.getElementById("js-map").querySelector("canvas").getContext('2d')

    let width = 7, height = 7

    let blues = 0

    const startX = xy[0] - Math.floor(width / 2)
    const startY = xy[1] - Math.floor(height / 2)

    for (vert = 0; vert < height; vert++) {
        for (hor = 0; hor < width; hor++) {
            xy = [hor + startX, vert + startY]
            pixelAtXY = canvasContext.getImageData(xy[0], xy[1], 1, 1).data
            for (i = 0; i < blue.length; i++) {
                if (blue[i] !== pixelAtXY[i]) {
                    blues++
                }
            }
        }
    }
    return blues <= width * height * .2
}

function zoom(z = 4) {
    if (map === undefined) {
        return
    }
    map.getView().setZoom(z)
}

function getPolutionData(lon, lat) {
    let pollutionUrl = "https://api.waqi.info/feed/geo:" + lat + ";" + lon + "/?token=" + AQkey

    return fetch(pollutionUrl).then(response => {
        return response.json()
    }).catch(error => {
        console.log("error: ", error)
    }).then(result => {
        if (result.status !== "ok") return
        result.data.latLon = [lat, lon]
        return result.data
    })
}

function getMapState() {
    if (!map) return
    let view = map.getView()
    return {
        center: view.getCenter(),
        zoom: view.getZoom(),
        x: view.getCenter()[0],
        y: view.getCenter()[1],
        interacting: view.getInteracting(),
        animating: view.getAnimating(),
        resolutionForZoom: view.getResolutionForZoom(view.getZoom()),
        resolution: view.getResolution()
    }
}

function drawDot(lon, lat, color = [220, 220, 220, .5], data = null) {
    let feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat]))
    })

    let colorStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: circleRad,
            fill: new ol.style.Fill({
                color: color
            })
        })
    })

    if (data) {
        feature.set("pollutionInfo", data, true)
    }

    feature.setStyle(colorStyle)

    feature.setStyle(function (feature, resolution) {
        colorStyle.getImage().setScale(map.getView().getResolutionForZoom(10) / resolution)
        return colorStyle
    })

    source.addFeature(feature)

    return feature
}

function drawGrid() {
    source.clear()

    let glbox = map.getView().calculateExtent(map.getSize())
    let box = ol.proj.transformExtent(glbox, 'EPSG:3857', 'EPSG:4326')

    let right = box[2], left = box[0], top = box[3], bottom = box[1]

    let width = right - left
    let height = top - bottom

    const rowSize = 11
    const columnSize = 11

    circleRad = constRad / (map.getView().getResolutionForZoom(10) / getMapState().resolution)

    const lonInc = width / columnSize
    const latInc = height / rowSize

    const startLat = bottom + latInc / 2
    const startLon = left + lonInc / 2

    for (row = 2; row < rowSize-2; row++) {
        for (column = 2; column < columnSize-2; column++) {
            getPolutionData(startLon + lonInc * column, startLat + latInc * row).then(data => {
                let [resLat, resLon] = data.latLon
                if (isWater(resLon, resLat)) return
                //console.log(data.city.name.split(','))

                let d = []
                let val = 0

                for (i = 0; i < pollTypes.length; i++) {
                    if (data["iaqi"].hasOwnProperty(pollTypes[i])) {
                        if (pollTypes[i] === "pm25") val = data["iaqi"][pollTypes[i]].v
                        d.push(pollVals[i] + data["iaqi"][pollTypes[i]].v)
                    }
                }

                let color = [Math.min(val * 2, 255), Math.max(255 - val * 2, 0), Math.min(Math.max(0, 2 * (val - 70)), 255), .5]

                drawDot(resLon, resLat, color, d)
            })
        }
    }
    getPolutionData(ogLon, ogLat)
    .then(function(data) {
        llTitle.textContent = "The pollution levels in " + city + " are:"
        for (let m = 0; m < 7; m++) {
            llContent.children[m].textContent = "";
        }
        z = 0;
        let sstr = "";
        for (const potype of pollTypes) {
            if (potype in data.iaqi) {
                llContent.children[z].textContent = potype + ": " + data.iaqi[potype].v;
                sstr = sstr + llContent.children[z].textContent + "  ";
                z++;
            }
        }
        //log the central point to stored searches
        storedSearches[0].push(city + " " + zip);
        storedSearches[1].push(sstr)
    })
}

function waitForCond(obj, cond, update = () => { return obj }, state = true) {
    return new Promise(resolve => {
        function check(o) {
            if (o[cond] === state) {
                resolve()
            }
            else {
                update()
                setTimeout(check, 450, o)
            }
        }
        check(obj)
    })
}

//change zip code when user adds zip code and clicks SUMBIT
function changeZip() {
    zip = locZip.value
    const zipUrl = "https://nominatim.openstreetmap.org/search?postalcode=" + zip + "&country=USA&format=json"
    fetch(zipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        lat = data[0].lat
        lon = data[0].lon
        try {
            city = data[0].display_name.substring(0, data[0].display_name.indexOf(","))
        } catch {
            city = "???"
        }
        if (lat && lon) {
            goToCoord(lon, lat, drawGrid)
        }
    }).catch(function () {
        zip = "enter valid zip"
        locZip.value = ""
        locZip.placeholder = zip
    })
}

function changeCoord() {
    const coords = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')
    lat = coords[1]
    lon = coords[0]

    const locUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon
    fetch(locUrl)
        .then(function (response) {
            return response.json()
        })
        .then(function (data) {
            try {
                city = data.display_name.substring(data.display_name.indexOf(",") + 1)//extract city, at this zoom level(16)it is second 
                city = city.substring(0, city.indexOf(","))
            } catch {
                city = "???"
            }
            try {
                const matches = data.display_name.match(/\b\d{5}\b/g)//extract zip if present
                if (matches) {//check if zip found
                    zip = matches[0]
                } else {
                    zip = "?????"
                }
            } catch {
                zip = "?????"
            }
            locZip.value = zip

            drawGrid()
        })
        .catch(function () {
            drawGrid()
            city = "???"
            zip = "?????"
            console.log("ERROR CHANGING LOCATION")
        })
}


function displaySearches(index) {
    if (index == 0) {
        PREV.setAttribute("style", "visibility:hidden")
    } else {
        PREV.setAttribute("style", "visibility:visible")
    }

    if (storedSearches[0].length - index < 4) {
        let w = 0;
        for (let v = index; v < storedSearches[0].length; v++) {
            HDISP.children[w].children[0].textContent = storedSearches[0][v];
            HDISP.children[w].children[1].textContent = storedSearches[1][v];
            w++;
        }
        NEXT.setAttribute("style", "visibility:hidden")

    } else {
        let w = 0;
        for (let v = index; v < index + 3; v++) {
            HDISP.children[w].children[0].textContent = storedSearches[0][v]
            HDISP.children[w].children[1].textContent = storedSearches[1][v]
            w++;
        }
        NEXT.setAttribute("style", "visibility:visible")

    }
    if (storedSearches[0].length == 0) {
        ERASE.setAttribute("style", "visibility:hidden")
    } else {
        ERASE.setAttribute("style", "visibility:visible")

    }

}

function seePrev() {
    fs -= 3;
    eraseSearchDisplay()
    displaySearches(fs)
}

function seeNext() {
    fs += 3;
    eraseSearchDisplay()
    displaySearches(fs)

}

function eraseSearches() {
    storedSearches = [[], []]
    localStorage.clear()//erase stored scoreboard
    eraseSearchDisplay()
    return
}

function eraseSearchDisplay() {
    ERASE.setAttribute("style", "visibility:hidden")
    NEXT.setAttribute("style", "visibility:hidden")
    PREV.setAttribute("style", "visibility:hidden")
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = ""
        HDISP.children[v].children[1].textContent = ""
    }
}