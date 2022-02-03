const AQkey = "03e6687524e359bbf0987c0f2ede90cb945e4404"//API key for pollution data
const ipUrl = 'https://ipapi.co/json/'//url for getting lat lon and zip using present ip

//location constiables
let lon
let lat
let zip
let city
const gridSize = 9//width and height of grid, !! must be odd !!

//pollution constiables
const pollTypes = ["pm25", "no2", "co", "so2", "nh3", "o3", "pm10"]

//map constiables
const ourZoom = 3
//these three must change with zoom, or first two musy change when user changes zoom
var lonInc = .2 * ourZoom//increments of lat lon degrees for the grid (set to be roughly equal in USA)
var latInc = .16 * ourZoom
var zoomLevel = 8.5 / (ourZoom / 2.4)//this isn't right////////////////////////////////////////////////////////////////////////////////!!

let features

let map
let vectorSource
let vectorLayer
//p in drawGrid loop function is to enumerate the points on the grid:
/*678
  345
  012*/
//DOM constiables
const overlayContainerEl = document.querySelector('.overlay-info')
const popupInfo = document.querySelector('.overlay-text')
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
const ZIN = document.getElementById("Zin")//zoom
ZIN.addEventListener("click", zin)
const ZOUT = document.getElementById("Zout")
ZOUT.addEventListener("click", zout)

//local storage stuff
var HDISP = document.getElementById("displayedSearches")
var fs=0;//index of first stored element to display
var PREV = document.getElementById("seePrev")
PREV.addEventListener("click", seePrev)
var NEXT = document.getElementById("seeNext")
NEXT.addEventListener("click", seeNext)
var ERASE = document.getElementById("eraseSearches")
ERASE.addEventListener("click", eraseSearches)

if (localStorage.getItem('place7896') == null){
    var storedSearches = [[],[]];
    for(let v=0; v<3; v++){
        HDISP.children[v].children[0].textContent="";
        HDISP.children[v].children[1].textContent="";
    }
    displaySearches(fs)
}else{
    var storedSearches = [JSON.parse(localStorage.place7896),JSON.parse(localStorage.levels7896)];
    displaySearches(fs)
}

start()

//launches when page loads, get location from IP and draw map
function start() {
    fetch(ipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        if (data.latitude && data.longitude) {//check that this ip returns a geo location
            lat = data.latitude
            lon = data.longitude
            if (data.city) {
                city = data.city
            } else {
                city = "Unnamed location"
            }
            if (data.postal) {
                zip = data.postal
            } else {
                zip = "00000"
            }
        } else {//if this ip does not return a geo location give Beverly Hills because why not
            lat = 34.07440
            lon = -117.40499
            zip = "90210"
            city = "Beverley Hills"
        }
        locZip.value = zip
        drawGrid(lat, lon, gridSize, city)
    }).catch(function () {
        console.log("Nooo")
    })
}

function drawGrid(lati, lonj, s, City) { //s is width and height of grid
   
    eraseSearchDisplay();
    displaySearches(fs);
    localStorage.place7896 = JSON.stringify(storedSearches[0]);
    localStorage.levels7896 = JSON.stringify(storedSearches[1]);

    
    
    
    
    
    const half = s / 2 - .5 //number of points on each side of central point
    console.log(s)
    const features = []
    let p = 0
    const greyFeatures = []
    for (let i = 0; i < s; i++) {
        
        for (let j = 0; j < s; j++) {
            let la = lati - half * latInc + i * latInc
            let lo = lonj - half * lonInc + j * lonInc
          
            const pollutionUrl = "https://api.waqi.info/feed/geo:" + la + ";" + lo + "/?token=" + AQkey
            fetch(pollutionUrl).then(function (response) {
                return response.json()
            }).catch(function () {
                console.log("NO RESPONSE")
            }).then(function (data) {
                if (i == half && j == half) {//if we are at central point display other pollution data if available
                    llTitle.textContent = "The pollution levels in " + city + " are:"
                    for (let m = 0; m < 7; m++) {
                        llContent.children[m].textContent = "";
                    }
                    z = 0;
                    let sstr="";
                    for (const potype of pollTypes) {
                        if (potype in data.data.iaqi) {
                            llContent.children[z].textContent = potype + ": " + data.data.iaqi[potype].v;
                            sstr=sstr+llContent.children[z].textContent+"  ";
                            z++;

                        }
                    }
                    //log the central point to stored searches
                    storedSearches[0].push(city+" "+zip);
                    storedSearches[1].push(sstr)
                    
                }
                features.push(new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([lo, la]))//describes a grid centered at lati lonj
                }))
                let q = data.data.iaqi["pm25"].v//get pm25 level and set color of point
                const colorStyle = new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 15,
                        fill: new ol.style.Fill({ color: [Math.min(q * 2, 255), Math.max(255 - q * 2, 0), Math.min(Math.max(0, 2 * (q - 70)), 255)] })//set color with rgb
                    })
                })

                //Applies an id of 'color' to each point with no data.
                let str="levels here:    ";
                for (const ptype of pollTypes) {
                    if (ptype in data.data.iaqi) {
                        str=str+ptype+": "+data.data.iaqi[ptype].v+"     ";
                    }
                }
                features[p].set('id', str)
                features[p].setStyle(colorStyle)
                //Applies dynamic size adjustment to each feature.
                /*features[p].setStyle(function (feature, resolution) {
                    colorStyle.getImage().setScale(map.getView().getResolutionForZoom(10) / resolution)
                    return colorStyle
                })*/
                p++
            })
                .catch(function () {//Catch occurs when no data available                    
                    const greyStyle = new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 15,
                            fill: new ol.style.Fill({ color: [130, 131, 130] })//set colors to grey if no data
                        })
                    })
                    //Applies an id of 'grey' to each point with no data.
                    greyFeatures.push(features[p])
                    let str="no data here";
                    for (let each of greyFeatures) {
                        each.set('id', str)
                    }
                    features[p].setStyle(greyStyle)
                    //Applies dynamic size adjustment to each feature.
                    /*features[p].setStyle(function (feature, resolution) {
                        greyStyle.getImage().setScale(map.getView().getResolutionForZoom(10) / resolution)
                        return greyStyle
                    })*/
                    p++
                    console.log("NO DATA FOUND FOR CIRCLE")
                })
                .then(function () {
                    if (p>80) {//if we are at final point draw map
                        //Creates vector source and vector layer for map projection.
                        const vectorSource = new ol.source.Vector({
                            features
                        })
                        const vectorLayer = new ol.layer.Vector({
                            source: vectorSource,
                            updateWhileAnimating: true,
                            updateWhileInteracting: true,
                            opacity: 0.5,
                        })
                        //draw map centered on given coordinates
                        map = new ol.Map({
                            target: 'map',
                            controls: [],
                            layers: [
                                new ol.layer.Tile({
                                    source: new ol.source.OSM()
                                }), vectorLayer
                            ],
                            view: new ol.View({
                                center: ol.proj.fromLonLat([lonj, lati]),
                                zoom: zoomLevel
                            })
                        })
                        let highlight
                        const featureOverlay = new ol.layer.Vector({
                            source: new ol.source.Vector(),
                            map: map,
                            updateWhileAnimating: true,
                            updateWhileInteracting: true,
                            opacity: 1,
                            zIndex: 2
                        })
                        //On hit detection of feature, change opacity and append info to info.innerHTML.
                        const displayFeatureInfo = function (pixel) {
                            vectorLayer.getFeatures(pixel)
                                .then(function (features) {
                                    const feature = features.length ? features[0] : undefined
                                    if (feature !== highlight) {
                                        if (highlight) {
                                            featureOverlay.getSource().removeFeature(highlight)
                                            popupInfo.innerHTML = ''
                                        }
                                        if (feature) {
                                            featureOverlay.getSource().addFeature(feature)
                                        }
                                        highlight = feature
                                    }
                                })
                        }

                        //On mouse hold down and drag, nothing happens.
                        map.on('pointermove', function (evt) {
                            if (evt.dragging) {
                                return
                            }
                            //If there is no dragging, then displayFeatureInfo runs
                            const pixel = map.getEventPixel(evt.originalEvent)
                            map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
                                let clickedCoordinate = feature.A.geometry.flatCoordinates
                                let clickedInfo = feature.get('id')
                                popup.setPosition(clickedCoordinate)
                                popupInfo.innerHTML = clickedInfo
                            })
                            displayFeatureInfo(pixel)
                        })

                        const popup = new ol.Overlay( {
                            element: overlayContainerEl,
                            zIndex: 1                
                        })
                        map.addOverlay(popup)

                        //Add click event to each feature.
                        /*map.on('click', function (evt) {

                        })*/                   
                        //Stops mousewheel zoom.
                        map.getInteractions().forEach(function (interaction) {
                            if (interaction instanceof ol.interaction.MouseWheelZoom) {
                                interaction.setActive(false)
                            }
                            if (interaction instanceof ol.interaction.KeyboardZoom) {
                                interaction.setActive(false)
                            }
                            if (interaction instanceof ol.interaction.PinchZoom) {
                                interaction.setActive(false)
                            }
                            if (interaction instanceof ol.interaction.DoubleClickZoom) {
                                interaction.setActive(false)
                            }
                        }, this)
                    }
                })
        }
    }
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
        try{
            city = data[0].display_name.substring(0, data[0].display_name.indexOf(","))
        }catch{
            city="???"
        }
        clearM()
        drawGrid(lat, lon, gridSize, city)
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

    z = 16///////////////////////////////////////////////////////////change this if we keep the zoom level
    const locUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon + "&zoom=" + z
    fetch(locUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        try{
            city = data.display_name.substring(data.display_name.indexOf(",") + 1)//extract city, at this zoom level(16)it is second 
            city = city.substring(0, city.indexOf(","))
        }catch{
            city="???"
        }
        try{
            const matches = data.display_name.match(/\b\d{5}\b/g)//extract zip if present
            if (matches) {//check if zip found
                zip = matches[0]
            } else {
                zip = "?????"
            }
        }catch{
            zip="?????"
        }
        locZip.value = zip
        //erase previous map and recreate map div
        clearM()
        drawGrid(lat, lon, gridSize, city)
    }).catch(function () {
        clearM()
        drawGrid(lat, lon, gridSize, city)
        city="???"
        zip="?????"

        console.log("ERROR CHANGING LOCATION")
    })
}

function clearM() {
    disp.children[0].remove()
    const m = document.createElement("div")
    m.setAttribute("class", "map")
    m.setAttribute("id", "map")
    disp.append(m)
}

function zout(){
    if (zoomLevel>4){
        lonInc*=4;
        latInc*=4;
        zoomLevel-=2;
        changeCoord();
    }
}

function zin(){
    if(zoomLevel<12){
        lonInc*=.25;
        latInc*=.25;
        zoomLevel+=2;
        changeCoord();
    }
}

function displaySearches(index){
    if(index==0){
        PREV.setAttribute("style","visibility:hidden");
    }else{
        PREV.setAttribute("style","visibility:visible");
    }
    
    if (storedSearches[0].length-index<4){
        let w=0;
        for(let v=index; v<storedSearches[0].length; v++){
            HDISP.children[w].children[0].textContent=storedSearches[0][v];
            HDISP.children[w].children[1].textContent=storedSearches[1][v];
            w++;
        }
        NEXT.setAttribute("style","visibility:hidden");
        
    }else{
        let w=0;
        for(let v=index; v<index+3; v++){
            HDISP.children[w].children[0].textContent=storedSearches[0][v];
            HDISP.children[w].children[1].textContent=storedSearches[1][v];
            w++;
        }
        NEXT.setAttribute("style","visibility:visible");
    
    }
    if(storedSearches[0].length==0){
        ERASE.setAttribute("style","visibility:hidden");
    }else{
        ERASE.setAttribute("style","visibility:visible");

    }

}

function seePrev(){
    fs-=3;
    eraseSearchDisplay()
    displaySearches(fs)
}

function seeNext(){
    fs+=3;
    eraseSearchDisplay()
    displaySearches(fs)

}

function eraseSearches(){
    storedSearches = [[],[]];
    localStorage.clear();//erase stored scoreboard
    eraseSearchDisplay();
    return;

}

function eraseSearchDisplay(){
    ERASE.setAttribute("style","visibility:hidden");
    NEXT.setAttribute("style","visibility:hidden");
    PREV.setAttribute("style","visibility:hidden");
    for(let v=0; v<3; v++){
        HDISP.children[v].children[0].textContent="";
        HDISP.children[v].children[1].textContent="";
    }


}