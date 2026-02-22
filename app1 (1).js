/**
 * Faster - Frontend
 * Parashikim trafiku · Matematika që modelon dhe përmirëson trafikun në jetën tonë të përditshme
 * Pa backend - llogaritjet dhe API e motit në shfletues.
 */

// ============ ORARET (Shqipëri) ============
// Amplitudat e kalibruara sipas realitetit (TomTom: rush ~58%, mesatare ~32%)
const SCHOOL_START = 8.0;
const SCHOOL_END = 13.0;
const BUSINESS_START = 9.0;
const BUSINESS_END = 17.0;
const PEAK_SPREAD = 0.5;

const REGIONS = [
  { code: "SHK", name: "Shkodër", lat: 42.0683, lon: 19.5126 },
  { code: "KUK", name: "Kukës", lat: 42.0683, lon: 20.4212 },
  { code: "DIB", name: "Dibër", lat: 41.6853, lon: 20.4299 },
  { code: "LEZ", name: "Lezhë", lat: 41.7861, lon: 19.6517 },
  { code: "DUR", name: "Durrës", lat: 41.3242, lon: 19.4554 },
  { code: "TIR", name: "Tiranë", lat: 41.3275, lon: 19.8187 },
  { code: "ELB", name: "Elbasan", lat: 41.1133, lon: 20.0842 },
  { code: "FIE", name: "Fier", lat: 40.7167, lon: 19.5667 },
  { code: "BER", name: "Berat", lat: 40.7058, lon: 19.9522 },
  { code: "VLO", name: "Vlorë", lat: 40.4667, lon: 19.4833 },
  { code: "KOR", name: "Korçë", lat: 40.6167, lon: 20.7831 },
  { code: "GJI", name: "Gjirokastër", lat: 40.0758, lon: 20.1389 },
];

const MAP_GEOJSON_URL = "https://storage.googleapis.com/location-grid-gis-layers/alb_admin1.geojson";
const TOMTOM_API_KEY = ""; // TomTom ka 2500 requests/ditë FALAS
const TOMTOM_TRAFFIC_STYLE = "relative";
const WEATHER_CACHE_TTL = 20 * 60 * 1000;
// Overpass API për trafik nga OpenStreetMap - 100% FALAS
const USE_FREE_TRAFFIC = true;
const weatherCache = new Map();
let mapDataPromise = null;
let mapInstance = null;
let geojsonLayer = null;
let trafficLayer = null;
let liveTrafficLayer = null;
let trafficLightLayer = null;
let trafficLightMarkers = new Map();
let gpsMarker = null;
let trafficMode = "simulated";
let trafficTimer = null;
let trafficLightTimer = null;
let routeLayer = null;
let destinationMarker = null;
let neighborhoodPoiLayer = null;
let currentPosition = null;
let currentDestination = null;
let watchId = null;
let navigationBusy = false;
let lastRouteOrigin = null;
let lastRouteTime = 0;
let selectedDepartureTime = null; // Koha e zgjedhur e nisjes
let freeTrafficLayer = null; // Layer për trafik falas
let trafficDataCache = new Map(); // Cache për të dhënat e trafikut
let isFreeTrafficEnabled = false;

const ROUTE_UPDATE_DISTANCE_M = 50;
const ROUTE_UPDATE_INTERVAL_MS = 12000;
const TRAFFIC_LIGHT_CACHE_KEY = "faster_traffic_lights_albania_v1";
const TRAFFIC_LIGHT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
let albaniaTrafficLights = [];
let trafficLightsLoading = false;
let trafficLightsLoaded = false;
// Semaforët: ngjyra në hartë + koha e ciklit (jeshil, verdhe, kuq në sekonda)
// Realiteti shqiptar: kuqi zgjat më shumë se jeshili (raport ~1.5:1 deri 2:1)
const TRAFFIC_LIGHTS = [
  // TIRANË - Qendër
  { id: "tir_qender", name: "Sheshi Skënderbej (Qendër)", lat: 41.3277, lon: 19.8188, green: 30, yellow: 3, red: 55, offset: 3 },
  { id: "tir_21", name: "21 Dhjetori", lat: 41.3263, lon: 19.7998, green: 25, yellow: 3, red: 48, offset: 17 },
  { id: "tir_piramida", name: "Pallati me shigjeta (Piramida)", lat: 41.3272, lon: 19.8186, green: 26, yellow: 3, red: 48, offset: 2 },
  { id: "tir_blloku", name: "Blloku", lat: 41.3182, lon: 19.8143, green: 24, yellow: 3, red: 46, offset: 15 },
  { id: "tir_myslym", name: "Myslym Shyri", lat: 41.3272, lon: 19.8093, green: 25, yellow: 3, red: 47, offset: 10 },
  
  // TIRANË - Rrugë kryesore
  { id: "tir_kavaja", name: "Rruga e Kavajës", lat: 41.3188, lon: 19.7988, green: 26, yellow: 3, red: 48, offset: 20 },
  { id: "tir_elbasanit", name: "Rruga e Elbasanit", lat: 41.3155, lon: 19.8322, green: 25, yellow: 3, red: 47, offset: 6 },
  { id: "tir_durresit", name: "Rruga e Durrësit", lat: 41.3295, lon: 19.8072, green: 27, yellow: 3, red: 50, offset: 12 },
  
  // TIRANË - Zona periferike
  { id: "tir_astir", name: "Astir / Unaza", lat: 41.3273, lon: 19.7835, green: 28, yellow: 3, red: 52, offset: 9 },
  { id: "tir_gazheli", name: "Gazheli", lat: 41.3322, lon: 19.7988, green: 24, yellow: 3, red: 45, offset: 5 },
  { id: "tir_5maji", name: "5 Maji", lat: 41.3446, lon: 19.8433, green: 28, yellow: 3, red: 50, offset: 11 },
  { id: "tir_15kateshi", name: "15 Katëshi", lat: 41.3389, lon: 19.8211, green: 23, yellow: 3, red: 44, offset: 8 },
  { id: "tir_pazari", name: "Pazari i Ri", lat: 41.3303, lon: 19.8267, green: 22, yellow: 3, red: 42, offset: 24 },
  { id: "tir_studenti", name: "Qyteti Studenti", lat: 41.3227, lon: 19.8409, green: 23, yellow: 3, red: 44, offset: 13 },
  { id: "tir_kombinat", name: "Kombinat", lat: 41.3096, lon: 19.7806, green: 24, yellow: 3, red: 46, offset: 18 },
  { id: "tir_laprake", name: "Laprake", lat: 41.3463, lon: 19.7897, green: 23, yellow: 3, red: 44, offset: 22 },
  { id: "tir_sauk", name: "Sauk", lat: 41.2975, lon: 19.8374, green: 22, yellow: 3, red: 42, offset: 16 },
  { id: "tir_kinostudio", name: "Kinostudio", lat: 41.3484, lon: 19.8504, green: 23, yellow: 3, red: 43, offset: 14 },
  { id: "tir_selita", name: "Selitë", lat: 41.3522, lon: 19.8555, green: 22, yellow: 3, red: 41, offset: 19 },
  { id: "tir_yzberisht", name: "Yzberisht", lat: 41.3588, lon: 19.8011, green: 21, yellow: 3, red: 40, offset: 25 },
  
  // DURRËS
  { id: "dur_qender", name: "Qendër Durrës (Sheshi)", lat: 41.3234, lon: 19.4553, green: 28, yellow: 3, red: 50, offset: 12 },
  { id: "dur_portuale", name: "Rruga Portuale", lat: 41.3189, lon: 19.4512, green: 26, yellow: 3, red: 48, offset: 8 },
  { id: "dur_tren", name: "Stacioni i Trenit", lat: 41.3186, lon: 19.4588, green: 25, yellow: 3, red: 46, offset: 15 },
  { id: "dur_plazh", name: "Rruga e Plazhit", lat: 41.3156, lon: 19.4473, green: 24, yellow: 3, red: 45, offset: 20 },
  { id: "dur_currila", name: "Currila", lat: 41.3298, lon: 19.4612, green: 23, yellow: 3, red: 43, offset: 11 },
  { id: "dur_shkozet", name: "Shkozet", lat: 41.2956, lon: 19.5234, green: 22, yellow: 3, red: 42, offset: 17 },
  
  // VLORË
  { id: "vlr_qender", name: "Qendër Vlorë (Sheshi)", lat: 40.4678, lon: 19.4892, green: 26, yellow: 3, red: 48, offset: 22 },
  { id: "vlr_pavaresia", name: "Bulevardi i Pavarësisë", lat: 40.4656, lon: 19.4884, green: 25, yellow: 3, red: 47, offset: 10 },
  { id: "vlr_skele", name: "Skelë (Port)", lat: 40.4625, lon: 19.4721, green: 24, yellow: 3, red: 45, offset: 18 },
  { id: "vlr_lungomare", name: "Lungomare", lat: 40.4589, lon: 19.4756, green: 23, yellow: 3, red: 44, offset: 14 },
  { id: "vlr_uji_ftohte", name: "Uji i Ftohtë", lat: 40.4512, lon: 19.4834, green: 22, yellow: 3, red: 42, offset: 21 },
  { id: "vlr_qendersore", name: "Rruga Qëndrore", lat: 40.4687, lon: 19.4912, green: 24, yellow: 3, red: 46, offset: 9 },
  
  // SHKODËR
  { id: "shk_qender", name: "Qendër Shkodër (Sheshi)", lat: 42.0685, lon: 19.5136, green: 25, yellow: 3, red: 47, offset: 28 },
  { id: "shk_13dhjetori", name: "13 Dhjetori", lat: 42.0698, lon: 19.5089, green: 24, yellow: 3, red: 45, offset: 12 },
  { id: "shk_kolauduar", name: "Rruga Kol Idromeno", lat: 42.0671, lon: 19.5112, green: 23, yellow: 3, red: 44, offset: 19 },
  { id: "shk_pedonalja", name: "Pedonalja", lat: 42.0692, lon: 19.5124, green: 22, yellow: 3, red: 42, offset: 15 },
  { id: "shk_ura", name: "Ura e Bahçallëkut", lat: 42.0534, lon: 19.5089, green: 24, yellow: 3, red: 46, offset: 7 },
  
  // ELBASAN
  { id: "elb_qender", name: "Qendër Elbasan (Sheshi)", lat: 41.1134, lon: 20.0839, green: 24, yellow: 3, red: 45, offset: 7 },
  { id: "elb_kalaja", name: "Kalaja (Qytet i vjetër)", lat: 41.1122, lon: 20.0822, green: 23, yellow: 3, red: 43, offset: 16 },
  { id: "elb_qemal", name: "Qemal Stafa", lat: 41.1145, lon: 20.0856, green: 22, yellow: 3, red: 42, offset: 22 },
  { id: "elb_rinia", name: "Rinia", lat: 41.1089, lon: 20.0798, green: 21, yellow: 3, red: 40, offset: 11 },
  
  // FIER
  { id: "fie_qender", name: "Qendër Fier (Sheshi)", lat: 40.7242, lon: 19.5583, green: 23, yellow: 3, red: 44, offset: 19 },
  { id: "fie_apollonia", name: "Rruga Apollonia", lat: 40.7256, lon: 19.5612, green: 22, yellow: 3, red: 42, offset: 13 },
  { id: "fie_mbrostar", name: "Mbrostar Ura", lat: 40.7189, lon: 19.5534, green: 21, yellow: 3, red: 41, offset: 24 },
  { id: "fie_bylis", name: "Rruga Bylis", lat: 40.7267, lon: 19.5598, green: 22, yellow: 3, red: 43, offset: 8 },
  
  // KORÇË
  { id: "kor_qender", name: "Qendër Korçë (Sheshi)", lat: 40.6183, lon: 20.7811, green: 22, yellow: 3, red: 42, offset: 14 },
  { id: "kor_republika", name: "Bulevardi Republika", lat: 40.6172, lon: 20.7789, green: 21, yellow: 3, red: 41, offset: 20 },
  { id: "kor_tren", name: "Stacioni i Trenit", lat: 40.6156, lon: 20.7723, green: 20, yellow: 3, red: 39, offset: 17 },
  { id: "kor_shen_gjergji", name: "Shën Gjergji", lat: 40.6198, lon: 20.7834, green: 21, yellow: 3, red: 40, offset: 9 },
  
  // BERAT
  { id: "ber_qender", name: "Qendër Berat (Sheshi)", lat: 40.706, lon: 19.9538, green: 21, yellow: 3, red: 40, offset: 26 },
  { id: "ber_kalaja", name: "Rruga për Kala", lat: 40.7078, lon: 19.9512, green: 20, yellow: 3, red: 38, offset: 15 },
  { id: "ber_antipatrea", name: "Antipatrea", lat: 40.7045, lon: 19.9556, green: 21, yellow: 3, red: 39, offset: 21 },
  { id: "ber_mangalem", name: "Mangalem", lat: 40.7089, lon: 19.9489, green: 20, yellow: 3, red: 37, offset: 11 },
  
  // GJIROKASTËR
  { id: "gji_qender", name: "Qendër Gjirokastër (Sheshi)", lat: 40.0758, lon: 20.1389, green: 21, yellow: 3, red: 40, offset: 13 },
  { id: "gji_kalaja", name: "Rruga për Kala", lat: 40.0778, lon: 20.1412, green: 20, yellow: 3, red: 38, offset: 19 },
  { id: "gji_çerçiz", name: "Çerçiz Topulli", lat: 40.0742, lon: 20.1367, green: 20, yellow: 3, red: 39, offset: 24 },
  
  // KUKËS
  { id: "kuk_qender", name: "Qendër Kukës (Sheshi)", lat: 42.0683, lon: 20.4212, green: 20, yellow: 3, red: 38, offset: 16 },
  { id: "kuk_liqeni", name: "Rruga e Liqenit", lat: 42.0698, lon: 20.4189, green: 19, yellow: 3, red: 37, offset: 22 },
  
  // LEZHË
  { id: "lez_qender", name: "Qendër Lezhë (Sheshi)", lat: 41.7861, lon: 19.6517, green: 21, yellow: 3, red: 40, offset: 18 },
  { id: "lez_kalaja", name: "Rruga për Kalaja e Lezhës", lat: 41.7889, lon: 19.6445, green: 20, yellow: 3, red: 38, offset: 14 },
  
  // LUSHNJË
  { id: "lus_qender", name: "Qendër Lushnjë (Sheshi)", lat: 40.9419, lon: 19.7003, green: 21, yellow: 3, red: 40, offset: 12 },
  { id: "lus_divjaka", name: "Rruga për Divjakë", lat: 40.9389, lon: 19.6978, green: 20, yellow: 3, red: 39, offset: 20 },
  
  // POGRADEC
  { id: "pog_qender", name: "Qendër Pogradec (Sheshi)", lat: 40.9025, lon: 20.6522, green: 21, yellow: 3, red: 40, offset: 15 },
  { id: "pog_liqeni", name: "Bulevardi i Liqenit", lat: 40.9012, lon: 20.6498, green: 20, yellow: 3, red: 38, offset: 21 },
  
  // SARANDË
  { id: "sar_qender", name: "Qendër Sarandë (Sheshi)", lat: 39.8753, lon: 20.0087, green: 22, yellow: 3, red: 42, offset: 17 },
  { id: "sar_butrinti", name: "Rruga për Butrint", lat: 39.8734, lon: 20.0112, green: 21, yellow: 3, red: 40, offset: 11 },
  { id: "sar_portuale", name: "Rruga Portuale", lat: 39.8778, lon: 20.0134, green: 21, yellow: 3, red: 41, offset: 25 },
  
  // KRUJË
  { id: "kru_qender", name: "Qendër Krujë (Sheshi)", lat: 41.5086, lon: 19.7928, green: 21, yellow: 3, red: 40, offset: 19 },
  { id: "kru_kalaja", name: "Rruga për Kalaja", lat: 41.5112, lon: 19.7889, green: 20, yellow: 3, red: 38, offset: 13 },
  
  // KAMZË (Tiranë Periferi)
  { id: "kam_qender", name: "Qendër Kamëz", lat: 41.3814, lon: 19.7639, green: 22, yellow: 3, red: 42, offset: 16 },
  
  // KAVAJË
  { id: "kav_qender", name: "Qendër Kavajë (Sheshi)", lat: 41.1856, lon: 19.5569, green: 21, yellow: 3, red: 40, offset: 14 },
  { id: "kav_plazh", name: "Rruga për Plazh", lat: 41.1789, lon: 19.5234, green: 20, yellow: 3, red: 39, offset: 23 },
];
const GPS_ALLOWED_AREAS = [
  {
    name: "Shqiperi",
    latMin: 39.55,
    latMax: 42.7,
    lonMin: 19.0,
    lonMax: 21.1,
  },
  {
    name: "Kosove",
    latMin: 41.8,
    latMax: 43.3,
    lonMin: 20.0,
    lonMax: 21.9,
  },
  {
    name: "Mali i Zi",
    latMin: 41.8,
    latMax: 43.7,
    lonMin: 18.4,
    lonMax: 20.4,
  },
];
// Vendet që përdorin qytetarët për emërtim (Gazheli, 5 Maji, 15 Katëshi, Pallati me shigjeta, etj.)
const LOCAL_PLACE_DICTIONARY = [
  { name: "Gazheli, Tirane", lat: 41.3322, lon: 19.7988, aliases: ["gazheli", "gazhel", "rruga e gazhelit"] },
  { name: "5 Maji, Tirane", lat: 41.3446, lon: 19.8433, aliases: ["5 maji", "rruga 5 maji", "pese maji", "pesemaji"] },
  { name: "15 Katëshi, Tirane", lat: 41.3389, lon: 19.8211, aliases: ["15 kateshi", "15 katesh", "pesembedhjete kateshi", "ndertesa 15 kateshe"] },
  { name: "Pallati me shigjeta (Piramida), Tirane", lat: 41.3272, lon: 19.8186, aliases: ["pallati me shigjeta", "piramida", "pyramid", "pallati me shigjeta tirane"] },
  { name: "Kombinat, Tirane", lat: 41.3096, lon: 19.7806, aliases: ["kombinat", "kombinati"] },
  { name: "Astir / Unaza e Re, Tirane", lat: 41.327, lon: 19.7815, aliases: ["astir", "unaza e re", "unaza ere", "unaza"] },
  { name: "Instituti Bujqësor, Tirane", lat: 41.3806, lon: 19.7606, aliases: ["institut", "instituti", "instituti bujqesor"] },
  { name: "Blloku, Tirane", lat: 41.3182, lon: 19.8143, aliases: ["blloku", "zona e bllokut"] },
  { name: "Laprake, Tirane", lat: 41.3463, lon: 19.7897, aliases: ["laprake", "lapraka"] },
  { name: "Don Bosko, Tirane", lat: 41.3426, lon: 19.7997, aliases: ["don bosko", "donbosko"] },
  { name: "Ali Demi, Tirane", lat: 41.3248, lon: 19.8405, aliases: ["ali demi"] },
  { name: "Kinostudio, Tirane", lat: 41.3484, lon: 19.8504, aliases: ["kinostudio", "kino studio"] },
  { name: "Sauk, Tirane", lat: 41.2975, lon: 19.8374, aliases: ["sauk", "sauku"] },
  { name: "Myslym Shyri, Tirane", lat: 41.3272, lon: 19.8093, aliases: ["myslym shyri", "rruga myslym shyri"] },
  { name: "21 Dhjetori, Tirane", lat: 41.3263, lon: 19.7998, aliases: ["21 dhjetori", "njezet e nje dhjetori"] },
  { name: "Komuna e Parisit, Tirane", lat: 41.3126, lon: 19.7994, aliases: ["komuna e parisit", "komuna parisit"] },
  { name: "Pazari i Ri, Tirane", lat: 41.3303, lon: 19.8267, aliases: ["pazari i ri", "pazari ri"] },
  { name: "Qyteti Studenti, Tirane", lat: 41.3227, lon: 19.8409, aliases: ["qyteti studenti", "studenti", "qytet studenti"] },
  { name: "Rruga e Kavajës, Tirane", lat: 41.3188, lon: 19.7988, aliases: ["kavaja", "rruga e kavajes", "kavajes"] },
  { name: "Rruga e Elbasanit, Tirane", lat: 41.3155, lon: 19.8322, aliases: ["elbasanit", "rruga e elbasanit", "rruga elbasanit"] },
  { name: "Selita, Tirane", lat: 41.3522, lon: 19.8555, aliases: ["selita", "selite"] },
  { name: "Yzberisht, Tirane", lat: 41.3588, lon: 19.8011, aliases: ["yzberisht", "yzberishti"] },
  { name: "Dajti, Tirane", lat: 41.3583, lon: 19.9233, aliases: ["dajti", "mali i dajtit", "dajt"] },
  { name: "Sheshi Skënderbej, Tirane", lat: 41.3276, lon: 19.8187, aliases: ["sheshi skenderbej", "skenderbej", "sheshi", "qendra"] },
  { name: "Tregu i Çamërisë, Tirane", lat: 41.3297, lon: 19.8122, aliases: ["tregu i camerise", "camerise", "tregu camerise"] },
];
// Stacionet kryesore te autobuseve (mund te zgjerohet sipas kerkeses)
const BUS_STOPS_DICTIONARY = [
  { name: "Stacioni Zogu i Zi, Tirane", lat: 41.3344, lon: 19.8016, aliases: ["zogu i zi", "stacioni zogu i zi", "terminali zogu i zi"] },
  { name: "Stacioni Qender (Skenderbej), Tirane", lat: 41.3276, lon: 19.8189, aliases: ["stacioni qender", "qender", "sheshi skenderbej"] },
  { name: "Stacioni 21 Dhjetori, Tirane", lat: 41.3263, lon: 19.7998, aliases: ["stacioni 21 dhjetori", "21 dhjetori"] },
  { name: "Stacioni Komuna e Parisit, Tirane", lat: 41.3126, lon: 19.7994, aliases: ["stacioni komuna e parisit", "komuna e parisit"] },
  { name: "Stacioni Astir, Tirane", lat: 41.327, lon: 19.7815, aliases: ["stacioni astir", "astir"] },
  { name: "Stacioni Instituti, Tirane", lat: 41.3806, lon: 19.7606, aliases: ["stacioni instituti", "instituti", "institut"] },
  { name: "Stacioni Porcelan, Tirane", lat: 41.3559, lon: 19.8526, aliases: ["stacioni porcelan", "porcelan"] },
  { name: "Stacioni Oxhak, Tirane", lat: 41.3587, lon: 19.8429, aliases: ["stacioni oxhak", "oxhak"] },
  { name: "Stacioni Medrese, Tirane", lat: 41.3365, lon: 19.8289, aliases: ["stacioni medrese", "medrese"] },
  { name: "Stacioni Qyteti Studenti, Tirane", lat: 41.3227, lon: 19.8409, aliases: ["stacioni qyteti studenti", "qyteti studenti", "studenti"] },
];
// Institucione, banka, exchange dhe karburante (pika reference ne Tirane)
const SERVICE_POI_DICTIONARY = [
  { name: "Bashkia Tirane", lat: 41.3274, lon: 19.8195, aliases: ["bashkia", "bashkia tirane", "municipality"], category: "institution", neighborhoods: ["qender", "blloku"] },
  { name: "Posta Shqiptare Qender", lat: 41.3291, lon: 19.8181, aliases: ["posta", "posta qender", "posta shqiptare"], category: "institution", neighborhoods: ["qender"] },
  { name: "QSUT", lat: 41.3189, lon: 19.8231, aliases: ["qsut", "spitali civil", "spitali nene tereza"], category: "institution", neighborhoods: ["qender", "rruga e elbasanit"] },
  { name: "Banka e Shqiperise", lat: 41.3295, lon: 19.8203, aliases: ["banka e shqiperise", "bank of albania"], category: "bank", neighborhoods: ["qender"] },
  { name: "Raiffeisen Bank Qender", lat: 41.3283, lon: 19.8179, aliases: ["raiffeisen", "raiffeisen bank"], category: "bank", neighborhoods: ["qender", "blloku"] },
  { name: "BKT Qender", lat: 41.3279, lon: 19.8199, aliases: ["bkt", "banka kombetare tregtare"], category: "bank", neighborhoods: ["qender"] },
  { name: "OTP Bank Qender", lat: 41.3285, lon: 19.8208, aliases: ["otp", "otp bank", "societe generale"], category: "bank", neighborhoods: ["qender"] },
  { name: "Credins Bank Qender", lat: 41.3272, lon: 19.8184, aliases: ["credins", "credins bank"], category: "bank", neighborhoods: ["qender", "myslym shyri"] },
  { name: "UnionNet Exchange Qender", lat: 41.3277, lon: 19.8174, aliases: ["unionnet", "exchange", "kembim valutor", "valute"], category: "exchange", neighborhoods: ["qender"] },
  { name: "Illyrian Exchange Qender", lat: 41.3288, lon: 19.8188, aliases: ["illyrian exchange", "exchange qender"], category: "exchange", neighborhoods: ["qender"] },
  { name: "Kastrati Karburant", lat: 41.3443, lon: 19.7978, aliases: ["kastrati", "kastrati karburant", "karburant kastrati"], category: "fuel", neighborhoods: ["laprake", "don bosko"] },
  { name: "Bolv Oil Karburant", lat: 41.3384, lon: 19.7899, aliases: ["bolv", "bolv oil", "karburant bolv"], category: "fuel", neighborhoods: ["astir", "laprake"] },
  { name: "EIDA Karburant", lat: 41.3523, lon: 19.8044, aliases: ["eida", "eida karburant", "karburant eida"], category: "fuel", neighborhoods: ["laprake", "yzberisht"] },
  { name: "Gega Oil Karburant", lat: 41.3318, lon: 19.8366, aliases: ["gega oil", "gega", "karburant gega"], category: "fuel", neighborhoods: ["5 maji", "kinostudio", "qender"] },
  { name: "Raiffeisen Bank Blloku", lat: 41.3176, lon: 19.8154, aliases: ["raiffeisen blloku"], category: "bank", neighborhoods: ["blloku", "myslym shyri"] },
  { name: "BKT Myslym Shyri", lat: 41.3269, lon: 19.8088, aliases: ["bkt myslym shyri"], category: "bank", neighborhoods: ["myslym shyri", "qender"] },
  { name: "Credins Astir", lat: 41.3278, lon: 19.7841, aliases: ["credins astir"], category: "bank", neighborhoods: ["astir", "laprake"] },
  { name: "OTP Komuna e Parisit", lat: 41.3132, lon: 19.7998, aliases: ["otp komuna e parisit"], category: "bank", neighborhoods: ["komuna e parisit", "blloku"] },
  { name: "Intesa Sanpaolo Qender", lat: 41.3292, lon: 19.8193, aliases: ["intesa", "intesa sanpaolo"], category: "bank", neighborhoods: ["qender"] },
  { name: "Abi Bank Tirane", lat: 41.3286, lon: 19.8172, aliases: ["abi bank", "abi"], category: "bank", neighborhoods: ["qender", "blloku"] },
  { name: "Kastrati Komuna e Parisit", lat: 41.3141, lon: 19.8012, aliases: ["kastrati komuna e parisit"], category: "fuel", neighborhoods: ["komuna e parisit", "blloku"] },
  { name: "Bolv Oil Don Bosko", lat: 41.3438, lon: 19.8012, aliases: ["bolv don bosko"], category: "fuel", neighborhoods: ["don bosko", "laprake"] },
  { name: "EIDA Astir", lat: 41.3291, lon: 19.7832, aliases: ["eida astir"], category: "fuel", neighborhoods: ["astir", "yzberisht"] },
  { name: "Gega Oil Kombinat", lat: 41.3112, lon: 19.7817, aliases: ["gega kombinat", "gega oil kombinat"], category: "fuel", neighborhoods: ["kombinat", "astir"] },
  { name: "Kastrati Rruga e Elbasanit", lat: 41.3165, lon: 19.8342, aliases: ["kastrati elbasanit"], category: "fuel", neighborhoods: ["rruga e elbasanit", "qyteti studenti"] },
  { name: "BKT Komuna e Parisit", lat: 41.3137, lon: 19.8003, aliases: ["bkt komuna e parisit"], category: "bank", neighborhoods: ["komuna e parisit", "selita"] },
  { name: "Raiffeisen Kinostudio", lat: 41.3491, lon: 19.8508, aliases: ["raiffeisen kinostudio"], category: "bank", neighborhoods: ["kinostudio", "5 maji"] },
  { name: "Credins 21 Dhjetori", lat: 41.3268, lon: 19.8005, aliases: ["credins 21 dhjetori"], category: "bank", neighborhoods: ["21 dhjetori", "myslym shyri"] },
  { name: "Kastrati Yzberisht", lat: 41.3593, lon: 19.8021, aliases: ["kastrati yzberisht"], category: "fuel", neighborhoods: ["yzberisht", "astir"] },
  { name: "Bolv Oil 5 Maji", lat: 41.3452, lon: 19.8441, aliases: ["bolv 5 maji"], category: "fuel", neighborhoods: ["5 maji", "kinostudio"] },
  { name: "BKT Durres", lat: 41.3236, lon: 19.4548, aliases: ["bkt durres"], category: "bank", neighborhoods: ["durres"] },
  { name: "Raiffeisen Durres", lat: 41.3159, lon: 19.4529, aliases: ["raiffeisen durres"], category: "bank", neighborhoods: ["durres"] },
  { name: "Kastrati Durres", lat: 41.3202, lon: 19.4465, aliases: ["kastrati durres"], category: "fuel", neighborhoods: ["durres"] },
  { name: "EIDA Durres", lat: 41.329, lon: 19.4612, aliases: ["eida durres"], category: "fuel", neighborhoods: ["durres"] },
  { name: "BKT Vlore", lat: 40.4682, lon: 19.4892, aliases: ["bkt vlore"], category: "bank", neighborhoods: ["vlore"] },
  { name: "Credins Vlore", lat: 40.4574, lon: 19.4865, aliases: ["credins vlore"], category: "bank", neighborhoods: ["vlore"] },
  { name: "Kastrati Vlore", lat: 40.4629, lon: 19.4972, aliases: ["kastrati vlore"], category: "fuel", neighborhoods: ["vlore"] },
  { name: "Gega Oil Vlore", lat: 40.4724, lon: 19.4824, aliases: ["gega vlore"], category: "fuel", neighborhoods: ["vlore"] },
  { name: "Raiffeisen Shkoder", lat: 42.0665, lon: 19.5139, aliases: ["raiffeisen shkoder"], category: "bank", neighborhoods: ["shkoder"] },
  { name: "BKT Shkoder", lat: 42.0701, lon: 19.5124, aliases: ["bkt shkoder"], category: "bank", neighborhoods: ["shkoder"] },
  { name: "Kastrati Shkoder", lat: 42.0744, lon: 19.5005, aliases: ["kastrati shkoder"], category: "fuel", neighborhoods: ["shkoder"] },
  { name: "Bolv Shkoder", lat: 42.0588, lon: 19.5209, aliases: ["bolv shkoder"], category: "fuel", neighborhoods: ["shkoder"] },
  { name: "BKT Fier", lat: 40.7236, lon: 19.5565, aliases: ["bkt fier"], category: "bank", neighborhoods: ["fier"] },
  { name: "Credins Fier", lat: 40.7281, lon: 19.5587, aliases: ["credins fier"], category: "bank", neighborhoods: ["fier"] },
  { name: "Kastrati Fier", lat: 40.7183, lon: 19.5663, aliases: ["kastrati fier"], category: "fuel", neighborhoods: ["fier"] },
  { name: "EIDA Fier", lat: 40.7342, lon: 19.5572, aliases: ["eida fier"], category: "fuel", neighborhoods: ["fier"] },
  { name: "BKT Elbasan", lat: 41.1118, lon: 20.0835, aliases: ["bkt elbasan"], category: "bank", neighborhoods: ["elbasan"] },
  { name: "Raiffeisen Elbasan", lat: 41.1147, lon: 20.0788, aliases: ["raiffeisen elbasan"], category: "bank", neighborhoods: ["elbasan"] },
  { name: "Kastrati Elbasan", lat: 41.1169, lon: 20.0704, aliases: ["kastrati elbasan"], category: "fuel", neighborhoods: ["elbasan"] },
  { name: "Gega Oil Elbasan", lat: 41.1086, lon: 20.0912, aliases: ["gega elbasan"], category: "fuel", neighborhoods: ["elbasan"] },
  { name: "BKT Korce", lat: 40.6182, lon: 20.7802, aliases: ["bkt korce"], category: "bank", neighborhoods: ["korce"] },
  { name: "Credins Korce", lat: 40.6221, lon: 20.7841, aliases: ["credins korce"], category: "bank", neighborhoods: ["korce"] },
  { name: "Kastrati Korce", lat: 40.6134, lon: 20.7925, aliases: ["kastrati korce"], category: "fuel", neighborhoods: ["korce"] },
  { name: "EIDA Korce", lat: 40.6252, lon: 20.7774, aliases: ["eida korce"], category: "fuel", neighborhoods: ["korce"] },
  { name: "BKT Berat", lat: 40.7056, lon: 19.9527, aliases: ["bkt berat"], category: "bank", neighborhoods: ["berat"] },
  { name: "Raiffeisen Berat", lat: 40.7038, lon: 19.9588, aliases: ["raiffeisen berat"], category: "bank", neighborhoods: ["berat"] },
  { name: "Kastrati Berat", lat: 40.6991, lon: 19.9668, aliases: ["kastrati berat"], category: "fuel", neighborhoods: ["berat"] },
  { name: "Gega Oil Berat", lat: 40.7109, lon: 19.9467, aliases: ["gega berat"], category: "fuel", neighborhoods: ["berat"] },
  { name: "BKT Lushnje", lat: 40.9417, lon: 19.7052, aliases: ["bkt lushnje"], category: "bank", neighborhoods: ["lushnje"] },
  { name: "Credins Lushnje", lat: 40.9356, lon: 19.7017, aliases: ["credins lushnje"], category: "bank", neighborhoods: ["lushnje"] },
  { name: "Kastrati Lushnje", lat: 40.9294, lon: 19.7089, aliases: ["kastrati lushnje"], category: "fuel", neighborhoods: ["lushnje"] },
  { name: "Bolv Lushnje", lat: 40.9462, lon: 19.6984, aliases: ["bolv lushnje"], category: "fuel", neighborhoods: ["lushnje"] },
  { name: "BKT Lezhe", lat: 41.7831, lon: 19.6433, aliases: ["bkt lezhe"], category: "bank", neighborhoods: ["lezhe"] },
  { name: "Raiffeisen Lezhe", lat: 41.7808, lon: 19.6461, aliases: ["raiffeisen lezhe"], category: "bank", neighborhoods: ["lezhe"] },
  { name: "Kastrati Lezhe", lat: 41.7908, lon: 19.6528, aliases: ["kastrati lezhe"], category: "fuel", neighborhoods: ["lezhe"] },
  { name: "EIDA Lezhe", lat: 41.7766, lon: 19.6398, aliases: ["eida lezhe"], category: "fuel", neighborhoods: ["lezhe"] },
  { name: "BKT Gjirokaster", lat: 40.0759, lon: 20.1393, aliases: ["bkt gjirokaster"], category: "bank", neighborhoods: ["gjirokaster"] },
  { name: "Credins Gjirokaster", lat: 40.0719, lon: 20.1438, aliases: ["credins gjirokaster"], category: "bank", neighborhoods: ["gjirokaster"] },
  { name: "Kastrati Gjirokaster", lat: 40.0662, lon: 20.1367, aliases: ["kastrati gjirokaster"], category: "fuel", neighborhoods: ["gjirokaster"] },
  { name: "Gega Oil Gjirokaster", lat: 40.0817, lon: 20.1453, aliases: ["gega gjirokaster"], category: "fuel", neighborhoods: ["gjirokaster"] },
  { name: "BKT Sarande", lat: 39.8759, lon: 20.0057, aliases: ["bkt sarande"], category: "bank", neighborhoods: ["sarande"] },
  { name: "Credins Sarande", lat: 39.8745, lon: 20.0119, aliases: ["credins sarande"], category: "bank", neighborhoods: ["sarande"] },
  { name: "Kastrati Sarande", lat: 39.8688, lon: 20.0192, aliases: ["kastrati sarande"], category: "fuel", neighborhoods: ["sarande"] },
  { name: "EIDA Sarande", lat: 39.8812, lon: 20.0018, aliases: ["eida sarande"], category: "fuel", neighborhoods: ["sarande"] },
  { name: "BKT Kavaje", lat: 41.1833, lon: 19.5561, aliases: ["bkt kavaje"], category: "bank", neighborhoods: ["kavaje"] },
  { name: "Raiffeisen Kavaje", lat: 41.1822, lon: 19.5596, aliases: ["raiffeisen kavaje"], category: "bank", neighborhoods: ["kavaje"] },
  { name: "Kastrati Kavaje", lat: 41.1765, lon: 19.5642, aliases: ["kastrati kavaje"], category: "fuel", neighborhoods: ["kavaje"] },
  { name: "Bolv Kavaje", lat: 41.1891, lon: 19.5499, aliases: ["bolv kavaje"], category: "fuel", neighborhoods: ["kavaje"] },
  { name: "BKT Pogradec", lat: 40.9027, lon: 20.6521, aliases: ["bkt pogradec"], category: "bank", neighborhoods: ["pogradec"] },
  { name: "Credins Pogradec", lat: 40.9001, lon: 20.6589, aliases: ["credins pogradec"], category: "bank", neighborhoods: ["pogradec"] },
  { name: "Kastrati Pogradec", lat: 40.9081, lon: 20.6459, aliases: ["kastrati pogradec"], category: "fuel", neighborhoods: ["pogradec"] },
  { name: "EIDA Pogradec", lat: 40.8967, lon: 20.6645, aliases: ["eida pogradec"], category: "fuel", neighborhoods: ["pogradec"] },
  { name: "BKT Kukes", lat: 42.0762, lon: 20.4218, aliases: ["bkt kukes"], category: "bank", neighborhoods: ["kukes"] },
  { name: "Credins Kukes", lat: 42.0742, lon: 20.4181, aliases: ["credins kukes"], category: "bank", neighborhoods: ["kukes"] },
  { name: "Kastrati Kukes", lat: 42.0705, lon: 20.4296, aliases: ["kastrati kukes"], category: "fuel", neighborhoods: ["kukes"] },
  { name: "Gega Oil Kukes", lat: 42.0812, lon: 20.4149, aliases: ["gega kukes"], category: "fuel", neighborhoods: ["kukes"] },
];
const NEIGHBORHOOD_DICTIONARY = [
  { name: "Shqiperi", lat: 41.1533, lon: 20.1683, aliases: ["shqiperi", "albania"] },
  { name: "Qender", lat: 41.3276, lon: 19.8189, aliases: ["qender", "sheshi skenderbej", "skenderbej"] },
  { name: "Blloku", lat: 41.3182, lon: 19.8143, aliases: ["blloku"] },
  { name: "Myslym Shyri", lat: 41.3272, lon: 19.8093, aliases: ["myslym shyri"] },
  { name: "Astir", lat: 41.327, lon: 19.7815, aliases: ["astir", "unaza e re"] },
  { name: "Laprake", lat: 41.3463, lon: 19.7897, aliases: ["laprake", "lapraka"] },
  { name: "Don Bosko", lat: 41.3426, lon: 19.7997, aliases: ["don bosko"] },
  { name: "Kinostudio", lat: 41.3484, lon: 19.8504, aliases: ["kinostudio"] },
  { name: "5 Maji", lat: 41.3446, lon: 19.8433, aliases: ["5 maji", "pese maji"] },
  { name: "Yzberisht", lat: 41.3588, lon: 19.8011, aliases: ["yzberisht"] },
  { name: "Komuna e Parisit", lat: 41.3126, lon: 19.7994, aliases: ["komuna e parisit", "komuna parisit"] },
  { name: "Kombinat", lat: 41.3096, lon: 19.7806, aliases: ["kombinat", "kombinati"] },
  { name: "Rruga e Elbasanit", lat: 41.3155, lon: 19.8322, aliases: ["rruga e elbasanit", "elbasanit"] },
  { name: "Qyteti Studenti", lat: 41.3227, lon: 19.8409, aliases: ["qyteti studenti", "studenti"] },
  { name: "Selita", lat: 41.3522, lon: 19.8555, aliases: ["selita", "selite"] },
  { name: "21 Dhjetori", lat: 41.3263, lon: 19.7998, aliases: ["21 dhjetori", "njezet e nje dhjetori"] },
  { name: "Ali Demi", lat: 41.3248, lon: 19.8405, aliases: ["ali demi"] },
  { name: "Pazari i Ri", lat: 41.3303, lon: 19.8267, aliases: ["pazari i ri", "pazari ri"] },
  { name: "Sauk", lat: 41.2975, lon: 19.8374, aliases: ["sauk", "sauku"] },
  { name: "Instituti", lat: 41.3806, lon: 19.7606, aliases: ["instituti", "institut"] },
  { name: "Durres", lat: 41.3242, lon: 19.4554, aliases: ["durres", "durrës"] },
  { name: "Vlore", lat: 40.4667, lon: 19.4833, aliases: ["vlore", "vlorë"] },
  { name: "Shkoder", lat: 42.0683, lon: 19.7928, aliases: ["shkoder", "shkodër"] },
  { name: "Fier", lat: 40.7167, lon: 19.5667, aliases: ["fier"] },
  { name: "Elbasan", lat: 41.1133, lon: 20.0842, aliases: ["elbasan"] },
  { name: "Korce", lat: 40.6167, lon: 20.7831, aliases: ["korce", "korçë"] },
  { name: "Berat", lat: 40.7058, lon: 19.9522, aliases: ["berat"] },
  { name: "Lushnje", lat: 40.9419, lon: 19.705, aliases: ["lushnje"] },
  { name: "Lezhe", lat: 41.7861, lon: 19.6468, aliases: ["lezhe", "lezhë"] },
  { name: "Gjirokaster", lat: 40.0758, lon: 20.1389, aliases: ["gjirokaster", "gjirokastër"] },
  { name: "Sarande", lat: 39.8756, lon: 20.005, aliases: ["sarande", "sarandë"] },
  { name: "Kavaje", lat: 41.1845, lon: 19.5562, aliases: ["kavaje", "kavajë"] },
  { name: "Pogradec", lat: 40.9025, lon: 20.6525, aliases: ["pogradec"] },
  { name: "Kukes", lat: 42.0769, lon: 20.4219, aliases: ["kukes", "kukës"] },
];

function gaussianPeak(hour, center, spread, amplitude = 1) {
  return amplitude * Math.exp(-((hour - center) ** 2) / (2 * spread ** 2));
}

function getBaseTraffic(hour) {
  const schoolMorning = gaussianPeak(hour, SCHOOL_START - 0.5, PEAK_SPREAD, 26);
  const schoolDrop = gaussianPeak(hour, SCHOOL_START, PEAK_SPREAD * 0.8, 24);
  const businessMorning = gaussianPeak(hour, BUSINESS_START, PEAK_SPREAD, 20);
  const lunch = gaussianPeak(hour, 12.0, 0.6, 12);
  const schoolAfternoon = gaussianPeak(hour, SCHOOL_END, PEAK_SPREAD, 12);
  const businessEvening = gaussianPeak(hour, BUSINESS_END, PEAK_SPREAD * 1.2, 38);
  const baseline = (hour >= 6 && hour <= 23) ? 5 : 2;

  const total = baseline + schoolMorning + schoolDrop + businessMorning + lunch + schoolAfternoon + businessEvening;
  return Math.min(100, total);
}

function getWeatherMultiplier(weatherCode, precipitation) {
  const snowCodes = [71, 73, 75, 77];
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82];
  const fogCodes = [45, 48];
  const stormCodes = [95, 96, 99];

  if (snowCodes.includes(weatherCode)) return 1.4 + Math.min(0.3, precipitation / 10);
  if (rainCodes.includes(weatherCode)) return 1.2 + Math.min(0.25, precipitation / 5);
  if (fogCodes.includes(weatherCode)) return 1.25;
  if (stormCodes.includes(weatherCode)) return 1.5;
  return 1.0;
}

function predictTraffic(hour, weatherCode = 0, precipitation = 0) {
  const base = getBaseTraffic(hour);
  const mult = getWeatherMultiplier(weatherCode, precipitation);
  const adjusted = Math.min(100, base * mult);
  return {
    hour,
    base_traffic: Math.round(base * 10) / 10,
    weather_multiplier: Math.round(mult * 100) / 100,
    predicted_traffic: Math.round(adjusted * 10) / 10,
    level: adjusted < 30 ? "low" : adjusted < 55 ? "medium" : "high",
  };
}

// ============ OPEN-METEO API (direkt nga shfletuesi) ============
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=weather_code,precipitation&forecast_days=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Moti nuk u ngarkua");
  return res.json();
}

async function fetchWeatherCached(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.ts < WEATHER_CACHE_TTL) {
    return cached.data;
  }
  const data = await fetchWeather(lat, lon);
  weatherCache.set(key, { ts: Date.now(), data });
  return data;
}

async function loadMapData() {
  if (!mapDataPromise) {
    mapDataPromise = fetch(MAP_GEOJSON_URL).then((res) => {
      if (!res.ok) throw new Error("Harta nuk u ngarkua");
      return res.json();
    });
  }
  return mapDataPromise;
}

function normalizeName(name) {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getFeatureName(props) {
  if (!props) return "";
  return (
    props.name ||
    props.NAME_1 ||
    props.admin1Name ||
    props.state ||
    props.region ||
    props.NAME ||
    ""
  );
}

function getLevelStyle(level) {
  if (level === "low") {
    return { color: "#3fb950", fillColor: "rgba(63, 185, 80, 0.35)" };
  }
  if (level === "medium") {
    return { color: "#d29922", fillColor: "rgba(210, 153, 34, 0.35)" };
  }
  return { color: "#f85149", fillColor: "rgba(248, 81, 73, 0.4)" };
}

function setNavStatus(message) {
  const navStatusEl = document.getElementById("nav-status");
  if (navStatusEl) navStatusEl.textContent = message;
}

function getTrafficLightsSource() {
  return albaniaTrafficLights.length > 0 ? albaniaTrafficLights : TRAFFIC_LIGHTS;
}

function buildTrafficLightFromNode(node) {
  const idNum = Number(node.id) || Math.floor(Math.random() * 100000);
  const tags = node?.tags || {};

  const parseSec = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(String(value).trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  };

  const parsedCycle =
    parseSec(tags["traffic_signals:cycle_time"]) ||
    parseSec(tags["cycle"]) ||
    parseSec(tags["cycle_time"]);
  const parsedGreen =
    parseSec(tags["traffic_signals:green"]) ||
    parseSec(tags["green"]) ||
    parseSec(tags["duration:green"]);
  const parsedRed =
    parseSec(tags["traffic_signals:red"]) ||
    parseSec(tags["red"]) ||
    parseSec(tags["duration:red"]);
  const parsedYellow =
    parseSec(tags["traffic_signals:yellow"]) ||
    parseSec(tags["yellow"]) ||
    parseSec(tags["duration:yellow"]);
  const parsedOffset =
    parseSec(tags["offset"]) ||
    parseSec(tags["traffic_signals:offset"]);

  let yellow = parsedYellow || 4;
  let green = parsedGreen;
  let red = parsedRed;

  if (parsedCycle && green && !red) {
    red = Math.max(10, parsedCycle - green - yellow);
  } else if (parsedCycle && red && !green) {
    green = Math.max(10, parsedCycle - red - yellow);
  } else if (parsedCycle && !green && !red) {
    green = Math.round(parsedCycle * 0.45);
    red = Math.max(10, parsedCycle - green - yellow);
  }

  if (!green) green = 36;
  if (!red) red = 42;
  if (green + yellow + red < 25) {
    green = 36;
    yellow = 4;
    red = 42;
  }

  const total = green + yellow + red;
  const offset = parsedOffset !== null ? parsedOffset % total : idNum % total;

  return {
    id: `osm_${idNum}`,
    name: node?.tags?.name || node?.tags?.ref || "Semafor",
    lat: node.lat,
    lon: node.lon,
    green,
    yellow,
    red,
    offset,
  };
}

function readTrafficLightsFromCache() {
  try {
    const raw = localStorage.getItem(TRAFFIC_LIGHT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TRAFFIC_LIGHT_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writeTrafficLightsToCache(data) {
  try {
    localStorage.setItem(TRAFFIC_LIGHT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {
    // cache optional
  }
}

async function loadAlbaniaTrafficLights() {
  if (trafficLightsLoaded || trafficLightsLoading) return;
  trafficLightsLoading = true;
  try {
    const cached = readTrafficLightsFromCache();
    if (cached && cached.length) {
      albaniaTrafficLights = cached;
      trafficLightsLoaded = true;
      if (trafficLightLayer) {
        trafficLightLayer.clearLayers();
      }
      trafficLightMarkers.clear();
      refreshTrafficLights();
      return;
    }

    const query = `
[out:json][timeout:90];
area["ISO3166-1"="AL"][admin_level=2]->.al;
node["highway"="traffic_signals"](area.al);
out body;
`;
    const res = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query.trim(),
    });
    if (!res.ok) throw new Error("Overpass error");
    const payload = await res.json();
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    const mapped = elements
      .filter((el) => typeof el.lat === "number" && typeof el.lon === "number")
      .map(buildTrafficLightFromNode);
    if (mapped.length) {
      albaniaTrafficLights = mapped;
      trafficLightsLoaded = true;
      writeTrafficLightsToCache(mapped);
      if (trafficLightLayer) {
        trafficLightLayer.clearLayers();
      }
      trafficLightMarkers.clear();
      refreshTrafficLights();
    }
  } catch (_) {
    // fallback to static list
  } finally {
    trafficLightsLoading = false;
  }
}

function getTrafficLightPhase(light, nowMs = Date.now()) {
  const totalSec = light.green + light.yellow + light.red;
  const totalMs = totalSec * 1000;
  const offsetMs = (light.offset || 0) * 1000;
  const elapsedMs = ((nowMs + offsetMs) % totalMs + totalMs) % totalMs;
  const greenMs = light.green * 1000;
  const yellowMs = light.yellow * 1000;
  const greenYellowMs = greenMs + yellowMs;

  if (elapsedMs < greenMs) {
    return {
      current: "green",
      next: "yellow",
      remaining: Math.max(1, Math.ceil((greenMs - elapsedMs) / 1000)),
    };
  }
  if (elapsedMs < greenYellowMs) {
    return {
      current: "yellow",
      next: "red",
      remaining: Math.max(1, Math.ceil((greenYellowMs - elapsedMs) / 1000)),
    };
  }
  return {
    current: "red",
    next: "green",
    remaining: Math.max(1, Math.ceil((totalMs - elapsedMs) / 1000)),
  };
}

function trafficLightColorHex(color) {
  if (color === "green") return "#16a34a";
  if (color === "yellow") return "#f59e0b";
  return "#dc2626";
}

function trafficLightLabel(color) {
  if (color === "green") return "jeshile";
  if (color === "yellow") return "verdhe";
  return "kuqe";
}

function trafficLightIconHtml(color) {
  return `<div class="traffic-light-dot" style="background:${trafficLightColorHex(color)}"></div>`;
}

function ensureTrafficLightLayer() {
  if (!mapInstance || typeof L === "undefined") return;
  if (!trafficLightLayer) {
    trafficLightLayer = L.layerGroup().addTo(mapInstance);
  }
}

function refreshTrafficLights() {
  if (!mapInstance || typeof L === "undefined") return;
  ensureTrafficLightLayer();
  const now = Date.now();
  const lights = getTrafficLightsSource();
  if (!lights.length) return;

  lights.forEach((light) => {
    const phase = getTrafficLightPhase(light, now);
    const markerId = light.id || `${light.lat},${light.lon}`;
    let marker = trafficLightMarkers.get(markerId);

    if (!marker) {
      marker = L.marker([light.lat, light.lon], {
        icon: L.divIcon({
          className: "traffic-light-icon",
          html: trafficLightIconHtml(phase.current),
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      });
      marker.addTo(trafficLightLayer);
      trafficLightMarkers.set(markerId, marker);
    } else {
      marker.setIcon(
        L.divIcon({
          className: "traffic-light-icon",
          html: trafficLightIconHtml(phase.current),
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
      );
    }

    const popupHtml =
      `<strong>${light.name}</strong><br>` +
      `Aktual: ${trafficLightLabel(phase.current)} - Pas ${phase.remaining}s -> ${trafficLightLabel(phase.next)}<br>` +
      `<small>Koha e ciklit: jeshil ${light.green}s, verdhe ${light.yellow}s, kuq ${light.red}s</small>`;
    marker.bindPopup(popupHtml);
  });
}

function isWithinAllowedGpsRegion(lat, lon) {
  return GPS_ALLOWED_AREAS.some(
    (area) =>
      lat >= area.latMin &&
      lat <= area.latMax &&
      lon >= area.lonMin &&
      lon <= area.lonMax
  );
}

function clearNavigationRoute() {
  if (mapInstance && routeLayer) {
    mapInstance.removeLayer(routeLayer);
  }
  if (mapInstance && destinationMarker) {
    mapInstance.removeLayer(destinationMarker);
  }
  routeLayer = null;
  destinationMarker = null;
  currentDestination = null;
  lastRouteOrigin = null;
  lastRouteTime = 0;
}

function clearNeighborhoodPois() {
  if (mapInstance && neighborhoodPoiLayer) {
    mapInstance.removeLayer(neighborhoodPoiLayer);
  }
  neighborhoodPoiLayer = null;
}

function findNeighborhood(query) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return null;
  for (const neighborhood of NEIGHBORHOOD_DICTIONARY) {
    const terms = [neighborhood.name, ...(neighborhood.aliases || [])];
    for (const term of terms) {
      const normalizedTerm = normalizeName(term);
      if (
        normalizedQuery === normalizedTerm ||
        normalizedQuery.includes(normalizedTerm) ||
        normalizedTerm.includes(normalizedQuery)
      ) {
        return neighborhood;
      }
    }
  }
  return null;
}

function getServicesForNeighborhood(neighborhoodName) {
  const target = normalizeName(neighborhoodName);
  if (target === "shqiperi" || target === "albania") {
    return SERVICE_POI_DICTIONARY.filter(
      (poi) => poi.category === "bank" || poi.category === "fuel"
    );
  }
  return SERVICE_POI_DICTIONARY.filter((poi) => {
    const isWantedCategory = poi.category === "bank" || poi.category === "fuel";
    if (!isWantedCategory) return false;
    const areas = poi.neighborhoods || [];
    return areas.some((name) => normalizeName(name) === target);
  });
}

function showNeighborhoodServices(neighborhood) {
  if (!mapInstance || typeof L === "undefined") return;
  clearNeighborhoodPois();

  const services = getServicesForNeighborhood(neighborhood.name);
  if (services.length === 0) {
    mapInstance.setView([neighborhood.lat, neighborhood.lon], 14, { animate: true });
    setNavStatus(`Nuk u gjeten banka/karburante per zonen ${neighborhood.name}.`);
    return;
  }

  neighborhoodPoiLayer = L.layerGroup().addTo(mapInstance);
  const bounds = [];
  for (const service of services) {
    const marker = L.circleMarker([service.lat, service.lon], {
      radius: 7,
      color: service.category === "bank" ? "#2563eb" : "#ea580c",
      fillColor: service.category === "bank" ? "#60a5fa" : "#fb923c",
      fillOpacity: 0.9,
      weight: 2,
    });
    marker.bindPopup(`${service.name} (${service.category === "bank" ? "Banke" : "Karburant"})`);
    marker.addTo(neighborhoodPoiLayer);
    bounds.push([service.lat, service.lon]);
  }

  bounds.push([neighborhood.lat, neighborhood.lon]);
  mapInstance.fitBounds(bounds, { padding: [30, 30] });

  const preview = services.slice(0, 8).map((item) => item.name).join(", ");
  const suffix = services.length > 8 ? ` (+${services.length - 8} te tjera)` : "";
  setNavStatus(`Zona ${neighborhood.name}: ${preview}${suffix}`);
}

function findLocalDestination(query) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return null;

  const allKnownPlaces = [
    ...BUS_STOPS_DICTIONARY,
    ...SERVICE_POI_DICTIONARY,
    ...LOCAL_PLACE_DICTIONARY,
  ];
  for (const place of allKnownPlaces) {
    const toCheck = [place.name, ...(place.aliases || [])];
    for (const term of toCheck) {
      const normalizedTerm = normalizeName(term);
      if (
        normalizedQuery === normalizedTerm ||
        normalizedQuery.includes(normalizedTerm) ||
        normalizedTerm.includes(normalizedQuery)
      ) {
        return {
          lat: place.lat,
          lon: place.lon,
          label: place.name,
        };
      }
    }
  }

  return null;
}

// Gjen vendin më të afërt për koordinata (për të treguar "Afër: Gazheli" në GPS)
function getNearestPlaceName(lat, lon, maxMeters = 2500) {
  let nearest = null;
  let minDist = maxMeters;

  const allKnownPlaces = [
    ...BUS_STOPS_DICTIONARY,
    ...SERVICE_POI_DICTIONARY,
    ...LOCAL_PLACE_DICTIONARY,
  ];
  for (const place of allKnownPlaces) {
    const d = distanceMeters({ lat, lon }, { lat: place.lat, lon: place.lon });
    if (d < minDist) {
      minDist = d;
      nearest = place;
    }
  }

  return nearest ? { name: nearest.name, meters: minDist } : null;
}

function formatGpsStatus(lat, lon) {
  const nearest = getNearestPlaceName(lat, lon);
  if (nearest) return `📍 Afër: ${nearest.name}`;
  return `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}min`;
}

function parseDestinationInput(raw) {
  const value = (raw || "").trim();
  if (!value) return null;
  const m = value.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (!m) return null;
  return { lat: Number(m[1]), lon: Number(m[2]), label: `${m[1]}, ${m[2]}` };
}

async function geocodeDestination(query) {
  const direct = parseDestinationInput(query);
  if (direct) {
    if (!isWithinAllowedGpsRegion(direct.lat, direct.lon)) {
      throw new Error("Destinacioni duhet te jete ne Shqiperi, Kosove ose Mal te Zi.");
    }
    return direct;
  }

  const localDestination = findLocalDestination(query);
  if (localDestination) return localDestination;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Destinacioni nuk u gjet.");
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Destinacioni nuk u gjet.");
  }
  const best = data[0];
  const bestLat = Number(best.lat);
  const bestLon = Number(best.lon);
  if (!isWithinAllowedGpsRegion(bestLat, bestLon)) {
    throw new Error("Destinacioni duhet te jete ne Shqiperi, Kosove ose Mal te Zi.");
  }
  return {
    lat: bestLat,
    lon: bestLon,
    label: best.display_name || query,
  };
}

async function fetchDrivingRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
    "?overview=full&geometries=geojson&steps=true&alternatives=3";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Rruga nuk u llogarit.");
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route || !route.geometry?.coordinates?.length) {
    throw new Error("Nuk ka rruge per kete destinacion.");
  }
  return route;
}

// Llogarit kohën e udhëtimit bazuar në trafikun e parashikuar
async function calculateRouteWithTraffic(from, to, departureTime) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
    "?overview=full&geometries=geojson&steps=true&alternatives=3";
  
  const res = await fetch(url);
  if (!res.ok) throw new Error("Rruga nuk u llogarit.");
  const data = await res.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error("Nuk ka rruge per kete destinacion.");
  }

  // Merr të gjitha rrugët alternative
  const routes = data.routes;
  
  // Përcakto kohën e nisjes (tani ose koha e zgjedhur)
  const depTime = departureTime || new Date();
  const depHour = depTime.getHours() + depTime.getMinutes() / 60;
  
  // Merr mot për qytetin aktual
  const { lat, lon } = getAlbaniaCoords();
  let weatherData;
  try {
    weatherData = await fetchWeather(lat, lon);
  } catch (err) {
    weatherData = null;
  }
  
  // Llogarit kohën e udhëtimit për çdo rrugë duke konsideruar trafikun
  const routesWithTraffic = await Promise.all(routes.map(async (route) => {
    const baseTime = route.duration; // në sekonda
    const distanceKm = route.distance / 1000;
    
    // Llogarit trafikun mesatar gjatë udhëtimit
    const travelHours = baseTime / 3600;
    let avgTrafficMultiplier = 1.0;
    
    // Simulo trafikun për çdo orë të udhëtimit
    for (let i = 0; i < Math.ceil(travelHours); i++) {
      const currentHour = (depHour + i) % 24;
      let trafficPred;
      
      if (weatherData && weatherData.hourly) {
        const hourly = weatherData.hourly;
        const codes = hourly.weather_code || [];
        const precip = hourly.precipitation || [];
        const idx = Math.min(i, codes.length - 1);
        trafficPred = predictTraffic(currentHour, codes[idx] || 0, precip[idx] || 0);
      } else {
        trafficPred = predictTraffic(currentHour, 0, 0);
      }
      
      // Konverto % trafikut në multiplikator kohe (trafik i lartë = më shumë kohë)
      // 20% trafik = 1.0x, 60% trafik = 1.4x, 100% trafik = 1.8x
      const trafficFactor = 1.0 + (trafficPred.predicted_traffic / 100) * 0.8;
      avgTrafficMultiplier += trafficFactor;
    }
    
    avgTrafficMultiplier = avgTrafficMultiplier / Math.ceil(travelHours + 1);
    
    // Koha totale me trafik
    const adjustedTime = baseTime * avgTrafficMultiplier;
    
    return {
      ...route,
      baseTime: baseTime,
      adjustedTime: adjustedTime,
      trafficMultiplier: avgTrafficMultiplier,
      distance: route.distance
    };
  }));
  
  // Gjej rrugën më të shpejtë (me kohën më të shkurtër)
  routesWithTraffic.sort((a, b) => a.adjustedTime - b.adjustedTime);
  
  return routesWithTraffic[0];
}

function renderRoute(route, destination) {
  if (!mapInstance || typeof L === "undefined") return;

  const path = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  if (routeLayer) {
    routeLayer.setLatLngs(path);
  } else {
    routeLayer = L.polyline(path, {
      color: "#0ea5e9",
      weight: 6,
      opacity: 0.9,
    }).addTo(mapInstance);
  }

  if (destinationMarker) {
    destinationMarker.setLatLng([destination.lat, destination.lon]);
    
    // Shto informacionin e kohës
    let popupText = `<strong>Destinacioni:</strong> ${destination.label}<br>`;
    popupText += `<strong>Distanca:</strong> ${(route.distance / 1000).toFixed(1)} km<br>`;
    
    if (route.baseTime) {
      popupText += `<strong>Koha bazë:</strong> ${formatDuration(route.baseTime)}<br>`;
      popupText += `<strong>Koha me trafik:</strong> ${formatDuration(route.adjustedTime)}<br>`;
      popupText += `<strong>Faktori i trafikut:</strong> ${route.trafficMultiplier.toFixed(2)}x`;
    } else {
      popupText += `<strong>Koha:</strong> ${formatDuration(route.duration)}`;
    }
    
    destinationMarker.bindPopup(popupText);
  } else {
    destinationMarker = L.marker([destination.lat, destination.lon]).addTo(
      mapInstance
    );
    
    let popupText = `<strong>Destinacioni:</strong> ${destination.label}<br>`;
    popupText += `<strong>Distanca:</strong> ${(route.distance / 1000).toFixed(1)} km<br>`;
    
    if (route.baseTime) {
      popupText += `<strong>Koha bazë:</strong> ${formatDuration(route.baseTime)}<br>`;
      popupText += `<strong>Koha me trafik:</strong> ${formatDuration(route.adjustedTime)}<br>`;
      popupText += `<strong>Faktori i trafikut:</strong> ${route.trafficMultiplier.toFixed(2)}x`;
    } else {
      popupText += `<strong>Koha:</strong> ${formatDuration(route.duration)}`;
    }
    
    destinationMarker.bindPopup(popupText);
  }

  const bounds = routeLayer.getBounds();
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds, { padding: [30, 30] });
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Shfletuesi nuk mbeshtet GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!isWithinAllowedGpsRegion(lat, lon)) {
          reject(
            new Error("GPS lejohet vetem ne Shqiperi, Kosove dhe Mal te Zi.")
          );
          return;
        }
        resolve(pos);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  });
}

async function recalculateRoute(force = false) {
  if (!currentPosition || !currentDestination || navigationBusy) return;

  const now = Date.now();
  const moved = distanceMeters(lastRouteOrigin, currentPosition);
  if (!force) {
    if (moved < ROUTE_UPDATE_DISTANCE_M) return;
    if (now - lastRouteTime < ROUTE_UPDATE_INTERVAL_MS) return;
  }

  navigationBusy = true;
  setNavStatus("Po rifreskohet rruga...");
  try {
    const route = await fetchDrivingRoute(currentPosition, currentDestination);
    renderRoute(route, currentDestination);
    lastRouteOrigin = { ...currentPosition };
    lastRouteTime = Date.now();
    setNavStatus(
      `Rruga aktive: ${formatDistance(route.distance)} - ${formatDuration(
        route.duration
      )}`
    );
  } catch (err) {
    setNavStatus(err.message || "Rruga nuk u llogarit.");
  } finally {
    navigationBusy = false;
  }
}

async function startNavigation() {
  const inputEl = document.getElementById("destination-input");
  const raw = inputEl ? inputEl.value : "";
  if (!raw || !raw.trim()) {
    setNavStatus("Vendos destinacionin.");
    return;
  }

  setNavStatus("Po kerkohet destinacioni...");
  try {
    initMap();
    const neighborhood = findNeighborhood(raw);
    if (neighborhood) {
      clearNavigationRoute();
      showNeighborhoodServices(neighborhood);
      return;
    }
    clearNeighborhoodPois();
    
    // Merr pozicionin aktual ose përdor qytetin e zgjedhur
    let currentPos;
    try {
      const pos = await getCurrentPosition();
      currentPos = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
    } catch (gpsErr) {
      // Nëse GPS nuk funksionon, përdor qytetin e zgjedhur
      const cityEl = document.getElementById("city");
      if (cityEl && cityEl.value) {
        const [lat, lon] = cityEl.value.split(",").map(Number);
        currentPos = { lat, lon };
      } else {
        currentPos = { lat: 41.3275, lon: 19.8187 }; // Tiranë default
      }
    }
    
    const destination = await geocodeDestination(raw);

    currentPosition = currentPos;
    currentDestination = destination;
    lastRouteOrigin = null;
    lastRouteTime = 0;

    if (mapInstance) {
      mapInstance.setView([currentPosition.lat, currentPosition.lon], 13, {
        animate: true,
      });
    }

    setNavStatus("Duke llogaritur rrugen me te shpejte sipas trafikut...");
    
    // Përdor kohën e zgjedhur ose kohën aktuale
    const departureTime = selectedDepartureTime || new Date();
    const route = await calculateRouteWithTraffic(currentPosition, destination, departureTime);
    
    renderRoute(route, destination);
    
    const timeInfo = route.adjustedTime 
      ? `${formatDuration(route.adjustedTime)} (me trafik)`
      : formatDuration(route.duration);
    setNavStatus(`Rruga me e shpejte: ${(route.distance / 1000).toFixed(1)} km · ${timeInfo}`);
    
    // Nis GPS tracking nëse është i disponueshëm
    try {
      watchGPS();
    } catch (e) {
      console.log("GPS tracking not available");
    }
  } catch (err) {
    if (err && err.code === 1) {
      setNavStatus("GPS jo i disponueshem. Duke perdorur qytetin e zgjedhur.");
    } else {
      setNavStatus(err.message || "Navigimi deshtoi.");
    }
  }
}

function initMap() {
  if (mapInstance) return;
  const mapEl = document.getElementById("leaflet-map");
  if (!mapEl || typeof L === "undefined") return;

  mapInstance = L.map(mapEl, {
    center: [41.1533, 20.1683],
    zoom: 7,
    minZoom: 6,
    maxZoom: 18,
    zoomControl: true,
    scrollWheelZoom: true,
    closePopupOnClick: false,
  });

  mapInstance.dragging.enable();
  mapInstance.touchZoom.enable();
  mapInstance.doubleClickZoom.enable();
  mapInstance.boxZoom.enable();
  mapInstance.keyboard.enable();

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: false,
    maxZoom: 19,
  }).addTo(mapInstance);

  trafficLayer = L.layerGroup().addTo(mapInstance);
  
  // Heqim semaforët - vetëm vija të trafikut
  // ensureTrafficLightLayer();
  // refreshTrafficLights();
  // if (trafficLightTimer) clearInterval(trafficLightTimer);
  // trafficLightTimer = setInterval(refreshTrafficLights, 1000);
  // loadAlbaniaTrafficLights();

  // Trafiku nuk ngarkohet automatikisht.
  // Ngarkohet pas ndërveprimit të parë me hartën.

  mapInstance.on("moveend", () => {
    refreshTrafficOverlay();
    // refreshTrafficLights(); // E hequr
  });

  mapInstance.on("click", async (event) => {
    if (!USE_FREE_TRAFFIC) return;
    if (!freeTrafficLayer) {
      initFreeTrafficLayer();
    }
    try {
      if (!isFreeTrafficEnabled) {
        isFreeTrafficEnabled = true;
        toggleFreeTraffic(true);
      }
      await updateFreeTrafficData();
    } catch (_) {}
  });

  // Provo GPS automatikisht
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!isWithinAllowedGpsRegion(latitude, longitude)) {
          const statusEl = document.getElementById("gps-status");
          if (statusEl) {
            statusEl.textContent = "GPS lejohet vetem ne Shqiperi, Kosove dhe Mal te Zi.";
          }
          const { lat, lon } = getAlbaniaCoords();
          mapInstance.setView([lat, lon], 10);
          clearNavigationRoute();
          return;
        }
        currentPosition = { lat: latitude, lon: longitude };
        mapInstance.setView([latitude, longitude], 12, { animate: true });
        gpsMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: "gps-marker",
            html: '<div style="background: #58a6ff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #58a6ff;"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(mapInstance);
        const statusEl = document.getElementById("gps-status");
        if (statusEl) statusEl.textContent = formatGpsStatus(latitude, longitude);
        watchGPS();
      },
      () => {
        // Fallback në qytet të zgjedhur
        const { lat, lon } = getAlbaniaCoords();
        mapInstance.setView([lat, lon], 10);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  } else {
    const { lat, lon } = getAlbaniaCoords();
    mapInstance.setView([lat, lon], 10);
  }
}

function applyZoomToLayer(layer) {
  if (!mapInstance) return;
  const bounds = layer.getBounds();
  const center = bounds.getCenter();
  const currentZoom = mapInstance.getZoom();
  let targetZoom = 12;
  if (currentZoom >= 12 && currentZoom < 15) {
    targetZoom = 15;
  } else if (currentZoom >= 15) {
    targetZoom = 12;
  }

  mapInstance.setView(center, targetZoom, { animate: true });
}

function clearTrafficLayer() {
  if (trafficLayer) trafficLayer.clearLayers();
}

function trafficColor(speed) {
  if (speed >= 45) return "#3fb950";
  if (speed >= 25) return "#d29922";
  return "#f85149";
}

function generateSimulatedTraffic(center) {
  if (!mapInstance || !trafficLayer) return;
  clearTrafficLayer();

  const baseLat = center.lat;
  const baseLon = center.lng;
  const lines = 22;

  for (let i = 0; i < lines; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.25;
    const offsetLon = (Math.random() - 0.5) * 0.35;
    const lengthLat = (Math.random() - 0.5) * 0.08;
    const lengthLon = (Math.random() - 0.5) * 0.12;
    const speed = Math.floor(10 + Math.random() * 55);

    const start = [baseLat + offsetLat, baseLon + offsetLon];
    const mid = [baseLat + offsetLat + lengthLat / 2, baseLon + offsetLon + lengthLon / 2];
    const end = [baseLat + offsetLat + lengthLat, baseLon + offsetLon + lengthLon];

    L.polyline([start, mid, end], {
      color: trafficColor(speed),
      weight: 4,
      opacity: 0.85,
    }).addTo(trafficLayer);
  }
}

function refreshTrafficOverlay() {
  if (!mapInstance) return;
  // Heqim simulated traffic - vetëm trafik real
  // generateSimulatedTraffic(mapInstance.getCenter());
  
  // Përditëso vetëm kur trafiku është aktivizuar nga përdoruesi
  if (USE_FREE_TRAFFIC && freeTrafficLayer && isFreeTrafficEnabled) {
    updateFreeTrafficData();
  }
}

// ========== TRAFIK FALAS (PA API KEY) ==========

// Krijimi i traffic layer falas bazuar në rrugët nga OpenStreetMap
function initFreeTrafficLayer() {
  if (!mapInstance || typeof L === "undefined") return;
  
  if (!freeTrafficLayer) {
    freeTrafficLayer = L.layerGroup().addTo(mapInstance);
  }
  
  console.log("Free traffic layer initialized");
}

// Merr të dhëna trafiku nga Overpass API (OpenStreetMap) - 100% FALAS
async function fetchOSMTrafficData(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // Query për rrugë kryesore në zonë
  const query = `
    [out:json][timeout:10];
    (
      way["highway"~"motorway|trunk|primary|secondary"]["name"](${sw.lat},${sw.lng},${ne.lat},${ne.lng});
    );
    out geom;
  `;
  
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("OSM request failed");
    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error("Error fetching OSM traffic:", error);
    return [];
  }
}

// Simulo trafikun bazuar në orën dhe llogin e rrugës
function estimateTrafficForRoad(roadType, currentHour) {
  let baseSpeed = 50; // km/h
  
  // Shpejtësi bazë sipas llojit të rrugës
  switch(roadType) {
    case 'motorway': baseSpeed = 90; break;
    case 'trunk': baseSpeed = 70; break;
    case 'primary': baseSpeed = 50; break;
    case 'secondary': baseSpeed = 40; break;
    default: baseSpeed = 30;
  }
  
  // Redukto shpejtësinë gjatë orëve të pikut
  if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
    baseSpeed *= 0.6; // 40% më ngadalë gjatë pikut
  } else if (currentHour >= 13 && currentHour <= 14) {
    baseSpeed *= 0.75; // 25% më ngadalë në drekë
  }
  
  return baseSpeed;
}

// Ngjyra sipas shpejtësisë
function getTrafficColorFromSpeed(speed) {
  if (speed >= 50) return "#3fb950"; // Jeshil - trafik i mirë
  if (speed >= 30) return "#d29922"; // Portokalli - trafik mesatar
  return "#f85149"; // Kuq - trafik i rëndë
}

// Përditëso të dhënat e trafikut falas
async function updateFreeTrafficData() {
  if (!mapInstance || !freeTrafficLayer) return;
  
  const bounds = mapInstance.getBounds();
  const zoom = mapInstance.getZoom();
  
  // Mos ngarko të dhëna nëse jemi shumë larg
  if (zoom < 11) {
    freeTrafficLayer.clearLayers();
    return;
  }
  
  // Kontrollo cache
  const cacheKey = `${bounds.toBBoxString()}_${zoom}`;
  const cached = trafficDataCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && now - cached.timestamp < 300000) { // 5 minuta cache
    renderTrafficFromOSM(cached.roads);
    return;
  }
  
  try {
    const roads = await fetchOSMTrafficData(bounds);
    trafficDataCache.set(cacheKey, { roads, timestamp: now });
    renderTrafficFromOSM(roads);
  } catch (error) {
    console.error("Error updating free traffic:", error);
  }
}

// Vizato rrugët me ngjyra trafiku
function renderTrafficFromOSM(roads) {
  if (!freeTrafficLayer) return;
  
  freeTrafficLayer.clearLayers();
  
  const currentHour = new Date().getHours();
  const zoom = mapInstance.getZoom();
  
  // Trashësia e vijave sipas zoom level
  let baseWeight = 4;
  if (zoom >= 13) baseWeight = 6;
  if (zoom >= 15) baseWeight = 8;
  if (zoom < 12) baseWeight = 3;
  
  roads.forEach(road => {
    if (!road.geometry || road.geometry.length === 0) return;
    
    const roadType = road.tags?.highway || 'secondary';
    const roadName = road.tags?.name || 'Rrugë pa emër';
    const speed = estimateTrafficForRoad(roadType, currentHour);
    const color = getTrafficColorFromSpeed(speed);
    
    const coordinates = road.geometry.map(point => [point.lat, point.lon]);
    
    // Krijo vijën e rrugës
    const roadLine = L.polyline(coordinates, {
      color: color,
      weight: baseWeight,
      opacity: 0, // E fshehte ne fillim; shfaqet vetem me klikim
      className: 'traffic-road-line'
    });
    
    // Shto popup me info
    const popupContent = `
      <div style="font-family: system-ui; min-width: 200px;">
        <strong style="font-size: 14px; color: ${color};">${roadName}</strong><br>
        <div style="margin-top: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span>Lloji:</span>
            <strong>${getRoadTypeLabel(roadType)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span>Shpejtësi:</span>
            <strong>${Math.round(speed)} km/h</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span>Gjendja:</span>
            <strong style="color: ${color};">${getTrafficLabel(speed)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0;">
            <span>Ora:</span>
            <strong>${currentHour}:00</strong>
          </div>
        </div>
        <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; font-size: 11px;">
          💡 Kliko mbi rrugë për ta theksuar
        </div>
      </div>
    `;
    
    roadLine.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'traffic-popup',
      autoClose: false,
      closeOnClick: false
    });

    
    // Hover efekt - trashësi më e madhe
    roadLine.on('mouseover', function(e) {
      const currentOpacity = this.options.opacity;
      if (currentOpacity > 0) {
        this.setStyle({
          weight: baseWeight + 4,
          opacity: 1.0
        });
      }
      
      // Shfaq tooltip të vogël
      if (!this.isPopupOpen()) {
        this.bindTooltip(roadName, {
          permanent: false,
          direction: 'top',
          className: 'traffic-tooltip'
        }).openTooltip();
      }
    });
    
    roadLine.on('mouseout', function(e) {
      const currentOpacity = this.options.opacity;
      if (currentOpacity > 0) {
        this.setStyle({
          weight: baseWeight,
          opacity: 0.7
        });
      }
      this.closeTooltip();
    });
    
    // Klik - thekso rrugën
    roadLine.on('click', function(e) {
      const wasOpen = this.isPopupOpen();

      // Hiq theksimin nga rrugët e tjera
      freeTrafficLayer.eachLayer(layer => {
        if (layer !== this && layer.setStyle) {
          if (layer.closePopup) {
            layer.closePopup();
          }
          layer.setStyle({
            weight: baseWeight,
            opacity: 0
          });
        }
      });
      
      // Shfaq ngjyren e trafikut vetem pasi klikohet rruga
      this.setStyle({
        color: color,
        weight: baseWeight + 6,
        opacity: 1.0
      });
      
      // Shfaq butonin e pastrimit
      const clearBtn = document.getElementById("clear-highlight");
      if (clearBtn) {
        clearBtn.style.display = 'inline-block';
      }

      // Klik i dytë mbi të njëjtën rrugë: mbyll popup-in
      if (wasOpen) {
        this.closePopup();
      } else {
        this.openPopup();
      }
      
      // Zoom në rrugë nëse është shumë larg
      const currentZoom = mapInstance.getZoom();
      if (currentZoom < 14) {
        mapInstance.fitBounds(this.getBounds(), {
          padding: [50, 50],
          maxZoom: 15
        });
      }
    });
    
    roadLine.addTo(freeTrafficLayer);
  });
}

// Helper function për emërtimin e llojit të rrugës
function getRoadTypeLabel(type) {
  const labels = {
    'motorway': 'Autostradë',
    'trunk': 'Rrugë Nacionale',
    'primary': 'Rrugë Kryesore',
    'secondary': 'Rrugë Sekondare',
    'tertiary': 'Rrugë Tretësore',
    'residential': 'Rrugë Banimi',
    'service': 'Rrugë Shërbimi'
  };
  return labels[type] || 'Rrugë';
}

// Helper function për etiketën e trafikut
function getTrafficLabel(speed) {
  if (speed >= 50) return '🟢 I mirë';
  if (speed >= 30) return '🟡 Mesatar';
  return '🔴 I rëndë';
}

// Toggle trafiku falas
function toggleFreeTraffic(enabled) {
  if (!freeTrafficLayer) {
    if (enabled) {
      initFreeTrafficLayer();
      updateFreeTrafficData();
    }
    return;
  }
  
  if (enabled) {
    freeTrafficLayer.addTo(mapInstance);
    updateFreeTrafficData();
  } else {
    freeTrafficLayer.clearLayers();
    mapInstance.removeLayer(freeTrafficLayer);
    const clearHighlightBtn = document.getElementById("clear-highlight");
    if (clearHighlightBtn) clearHighlightBtn.style.display = "none";
  }
}

// ========== END TRAFIK FALAS ==========


function getTomTomTrafficLayer() {
  if (!TOMTOM_API_KEY) return null;
  if (!liveTrafficLayer) {
    liveTrafficLayer = L.tileLayer(
      `https://api.tomtom.com/map/4/tile/flow/${TOMTOM_TRAFFIC_STYLE}/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
      {
        maxZoom: 19,
        opacity: 0.85,
      }
    );
  }
  return liveTrafficLayer;
}

function setTrafficMode(mode) {
  // Shfaq të dyja layer-at njëkohësisht
  if (mode === "live") {
    const layer = getTomTomTrafficLayer();
    if (layer && mapInstance && !mapInstance.hasLayer(layer)) {
      mapInstance.addLayer(layer);
    }
    // Mos e fshi simulated - shfaq të dyja
    if (trafficMode !== "simulated") {
      refreshTrafficOverlay();
    }
    trafficMode = "live";
    return true;
  }

  // Simulated - shfaq gjithmonë
  trafficMode = "simulated";
  refreshTrafficOverlay();
  return true;
}

async function renderMap(predictionsByName) {
  initMap();
  if (!mapInstance) return;

  if (!geojsonLayer) {
    const geojson = await loadMapData();
    geojsonLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const name = normalizeName(getFeatureName(feature.properties));
        const pred = predictionsByName.get(name);
        const level = pred?.level || "medium";
        const style = getLevelStyle(level);
        return {
          color: style.color,
          fillColor: style.fillColor,
          weight: 1,
          fillOpacity: 0.7,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = getFeatureName(feature.properties) || "Qark";
        layer.bindTooltip(name, { sticky: true });
        layer.on("click", () => applyZoomToLayer(layer));
      },
    }).addTo(mapInstance);
  } else {
    geojsonLayer.setStyle((feature) => {
      const name = normalizeName(getFeatureName(feature.properties));
      const pred = predictionsByName.get(name);
      const level = pred?.level || "medium";
      const style = getLevelStyle(level);
      return {
        color: style.color,
        fillColor: style.fillColor,
        weight: 1,
        fillOpacity: 0.7,
      };
    });
  }

  const fallback = document.getElementById("map-fallback");
  if (fallback) fallback.style.display = "none";

  refreshTrafficOverlay();
}

function setupTrafficControls() {
  // Hiq kontrollet e toggle - shfaq gjithmonë të dyja
  if (trafficTimer) clearInterval(trafficTimer);
  trafficTimer = setInterval(refreshTrafficOverlay, 60000);
}

// ============ UI ============
function formatHour(h) {
  const safe = Number.isFinite(h) ? h : 0;
  const totalMinutes = Math.round((((safe % 24) + 24) % 24) * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function getWeatherEmoji(code) {
  if (code >= 95) return "⛈️";
  if (code >= 80) return "🌧️";
  if (code >= 71) return "❄️";
  if (code >= 51) return "🌧️";
  if (code >= 45) return "🌫️";
  if (code >= 3) return "☁️";
  if (code >= 1) return "⛅";
  return "☀️";
}

function getLevelLabel(level) {
  if (level === "low") return "i ulët";
  if (level === "medium") return "mesatar";
  return "i lartë";
}

function updateUI(pred, weatherCode) {
  document.getElementById("traffic-value").textContent = pred.predicted_traffic;
  document.getElementById("base-traffic").textContent = pred.base_traffic;
  document.getElementById("weather-mult").textContent = pred.weather_multiplier;

  const badge = document.getElementById("level-badge");
  badge.textContent = getLevelLabel(pred.level);
  badge.className = "level-badge " + pred.level;
}

function drawChart(predictions) {
  const canvas = document.getElementById("traffic-chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, w, h);

  const maxVal = Math.max(...predictions.map((p) => p.predicted_traffic), 1);

  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  predictions.forEach((p, i) => {
    const x = pad.left + (chartW * i) / (predictions.length - 1 || 1);
    const y = pad.top + chartH - (p.predicted_traffic / maxVal) * chartH;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + chartW, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = "rgba(56, 139, 253, 0.2)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  predictions.forEach((p, i) => {
    const x = pad.left + (chartW * i) / (predictions.length - 1 || 1);
    const y = pad.top + chartH - (p.predicted_traffic / maxVal) * chartH;
    ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#8b949e";
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  for (let i = 0; i < 24; i += 4) {
    const x = pad.left + (chartW * i) / 23;
    ctx.fillText(formatHour(i), x, h - 8);
  }
}

function useGPS() {
  const statusEl = document.getElementById("gps-status");
  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = "Shfletuesi nuk mbështet GPS.";
    return;
  }

  if (statusEl) statusEl.textContent = "Duke kërkuar pozicionin…";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (!isWithinAllowedGpsRegion(latitude, longitude)) {
        if (statusEl) {
          statusEl.textContent = "GPS lejohet vetem ne Shqiperi, Kosove dhe Mal te Zi.";
        }
        clearNavigationRoute();
        return;
      }
      currentPosition = { lat: latitude, lon: longitude };
      if (statusEl) statusEl.textContent = formatGpsStatus(latitude, longitude);

      initMap();
      if (mapInstance) {
        mapInstance.setView([latitude, longitude], 13, { animate: true });
        if (gpsMarker) {
          gpsMarker.setLatLng([latitude, longitude]);
        } else {
          gpsMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "gps-marker",
              html: '<div style="background: #58a6ff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #58a6ff;"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(mapInstance);
        }
        refreshTrafficOverlay();
        recalculateRoute();
      }
    },
    (err) => {
      if (statusEl) {
        if (err.code === 1) {
          statusEl.textContent = "Lejo aksesin në lokacion.";
        } else {
          statusEl.textContent = "GPS nuk funksionoi.";
        }
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function watchGPS() {
  if (!navigator.geolocation) return;
  if (watchId !== null) return;
  
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (!isWithinAllowedGpsRegion(latitude, longitude)) {
        const statusEl = document.getElementById("gps-status");
        if (statusEl) {
          statusEl.textContent = "GPS jashte zones se lejuar (AL/XK/ME).";
        }
        clearNavigationRoute();
        return;
      }
      currentPosition = { lat: latitude, lon: longitude };
      const statusEl = document.getElementById("gps-status");
      if (statusEl) statusEl.textContent = formatGpsStatus(latitude, longitude);

      if (mapInstance) {
        if (gpsMarker) {
          gpsMarker.setLatLng([latitude, longitude]);
        } else {
          gpsMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "gps-marker",
              html: '<div style="background: #58a6ff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #58a6ff;"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(mapInstance);
        }
      }
      recalculateRoute();
    },
    () => {
      // Silent fail - GPS optional
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

function getAlbaniaCoords() {
  const v = document.getElementById("city").value;
  const [lat, lon] = v.split(",").map(Number);
  return { lat, lon };
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSelectedHourDecimal() {
  const preciseEl = document.getElementById("time-precise");
  if (preciseEl && preciseEl.value) {
    const parts = preciseEl.value.split(":");
    if (parts.length >= 2) {
      const hh = Number(parts[0]);
      const mm = Number(parts[1]);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        return hh + mm / 60;
      }
    }
  }
  const hourVal = Number(document.getElementById("hour").value);
  return Number.isFinite(hourVal) ? hourVal : 0;
}

function getWeatherAtHour(codes, precip, hourDecimal) {
  const idxBase = Math.max(0, Math.min(codes.length - 1, Math.floor(hourDecimal)));
  const idxNext = Math.max(0, Math.min(codes.length - 1, idxBase + 1));
  const frac = Math.max(0, Math.min(1, hourDecimal - idxBase));
  const code = frac >= 0.5 ? (codes[idxNext] ?? 0) : (codes[idxBase] ?? 0);
  const p0 = precip[idxBase] ?? 0;
  const p1 = precip[idxNext] ?? p0;
  const precipitation = p0 + (p1 - p0) * frac;
  return { code, precipitation };
}

async function updateMap(targetHour) {
  const mapTime = document.getElementById("map-time");
  const now = new Date();
  const hour = typeof targetHour === "number" ? targetHour : now.getHours() + now.getMinutes() / 60;
  if (mapTime) {
    mapTime.textContent = formatHour(hour);
  }

  const results = await Promise.allSettled(
    REGIONS.map(async (region) => {
      const weather = await fetchWeatherCached(region.lat, region.lon);
      const codes = weather?.hourly?.weather_code || [0];
      const precip = weather?.hourly?.precipitation || [0];
      const wx = getWeatherAtHour(codes, precip, hour);
      const pred = predictTraffic(hour, wx.code, wx.precipitation);
      return { region, pred };
    })
  );

  const predictionsByName = new Map();
  results.forEach((result, idx) => {
    const region = REGIONS[idx];
    if (result.status === "fulfilled") {
      predictionsByName.set(normalizeName(region.name), result.value.pred);
    } else {
      predictionsByName.set(normalizeName(region.name), { level: "medium", predicted_traffic: 0 });
    }
  });

  try {
    await renderMap(predictionsByName);
  } catch (err) {
    const fallback = document.getElementById("map-fallback");
    if (fallback) fallback.textContent = "Harta nuk u ngarkua. Kontrollo internetin.";
  }
}

async function refresh() {
  const hour = getSelectedHourDecimal();
  const { lat, lon } = getAlbaniaCoords();

  document.getElementById("weather-desc").textContent = "Duke ngarkuar…";
  document.getElementById("weather-icon").textContent = "⏳";

  try {
    const weather = await fetchWeather(lat, lon);
    const hourly = weather.hourly || {};
    const codes = hourly.weather_code || Array(48).fill(0);
    const precip = hourly.precipitation || Array(48).fill(0);

    const now = new Date();
    const predictions = [];
    for (let i = 0; i < 24; i++) {
      const h = (now.getHours() + i) % 24;
      const idx = Math.min(i, codes.length - 1);
      const c = codes[idx] ?? 0;
      const p = precip[idx] ?? 0;
      predictions.push(predictTraffic(h, c, p));
    }

    const wxNow = getWeatherAtHour(codes, precip, hour);
    const pred = predictTraffic(hour, wxNow.code, wxNow.precipitation);

    updateUI(pred, wxNow.code);
    document.getElementById("weather-icon").textContent = getWeatherEmoji(codes[0] ?? 0);
    document.getElementById("weather-desc").textContent = "Faster · Shqipëri · Open-Meteo · Parashikim me mot";

    drawChart(predictions);
    await updateMap(hour);
  } catch (err) {
    document.getElementById("traffic-value").textContent = "—";
    document.getElementById("base-traffic").textContent = "—";
    document.getElementById("weather-mult").textContent = "—";
    document.getElementById("level-badge").textContent = "Gabim";
    document.getElementById("weather-desc").textContent = err.message || "Nuk u ngarkua. Kontrollo internetin.";
    document.getElementById("weather-icon").textContent = "⚠️";
    await updateMap(hour);
  }
}

document.getElementById("hour").addEventListener("input", (e) => {
  const selectedHour = parseInt(e.target.value, 10);
  const preciseEl = document.getElementById("time-precise");
  if (preciseEl) {
    preciseEl.value = `${String(selectedHour).padStart(2, "0")}:00`;
  }
  document.getElementById("hour-display").textContent = formatHour(selectedHour);
  refresh();
});

const preciseTimeInput = document.getElementById("time-precise");
if (preciseTimeInput) {
  preciseTimeInput.addEventListener("input", (e) => {
    const value = e.target.value;
    if (!value) return;
    const parts = value.split(":");
    if (parts.length < 2) return;
    const hh = Number(parts[0]);
    if (Number.isFinite(hh)) {
      document.getElementById("hour").value = String(hh);
    }
    document.getElementById("hour-display").textContent = value;
    refresh();
  });
}

document.getElementById("refresh").addEventListener("click", refresh);
document.getElementById("city").addEventListener("change", () => {
  const { lat, lon } = getAlbaniaCoords();
  if (mapInstance) {
    mapInstance.setView([lat, lon], 12, { animate: true });
  }
  refresh();
});

// Inicializo orën dhe ekranin në bazë të orës aktuale
const hourInputInit = document.getElementById("hour");
const nowInit = new Date();
hourInputInit.value = String(nowInit.getHours());
document.getElementById("hour-display").textContent = formatTime(nowInit);
const preciseTimeInit = document.getElementById("time-precise");
if (preciseTimeInit) {
  preciseTimeInit.value = formatTime(nowInit);
}

// Inicializo hartën menjëherë
function initOnLoad() {
  if (typeof L !== "undefined") {
    initMap();
    if (mapInstance) {
      setTrafficMode("simulated");
      // Provo të shtosh live nëse ka API key
      if (TOMTOM_API_KEY) {
        const liveLayer = getTomTomTrafficLayer();
        if (liveLayer) {
          mapInstance.addLayer(liveLayer);
        }
      }
    }
  } else {
    setTimeout(initOnLoad, 100);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOnLoad);
} else {
  initOnLoad();
}


const locateBtn = document.getElementById("locate-me");
if (locateBtn) {
  locateBtn.addEventListener("click", () => {
    initMap();
    useGPS();
  });
}

const toggleTrafficBtn = document.getElementById("toggle-google-traffic");
if (toggleTrafficBtn) {
  toggleTrafficBtn.textContent = "🚦 Trafik Real (FALAS)";
  toggleTrafficBtn.addEventListener("click", () => {
    isFreeTrafficEnabled = !isFreeTrafficEnabled;
    toggleFreeTraffic(isFreeTrafficEnabled);
    toggleTrafficBtn.textContent = isFreeTrafficEnabled 
      ? "🚦 Fshih Trafikun" 
      : "🚦 Trafik Real (FALAS)";
    toggleTrafficBtn.style.background = isFreeTrafficEnabled 
      ? "var(--accent)" 
      : "transparent";
    toggleTrafficBtn.style.color = isFreeTrafficEnabled 
      ? "var(--bg)" 
      : "var(--accent)";
  });
}

// Butoni për të pastruar theksimin
const clearHighlightBtn = document.getElementById("clear-highlight");
if (clearHighlightBtn) {
  clearHighlightBtn.addEventListener("click", () => {
    if (freeTrafficLayer && mapInstance) {
      const zoom = mapInstance.getZoom();
      let baseWeight = 4;
      if (zoom >= 13) baseWeight = 6;
      if (zoom >= 15) baseWeight = 8;
      if (zoom < 12) baseWeight = 3;
      
      // Rivendos të gjitha rrugët në stilin normal
      freeTrafficLayer.eachLayer(layer => {
        if (layer.setStyle) {
          layer.setStyle({ weight: baseWeight, opacity: 0 });
          layer.closePopup();
        }
      });
      
      clearHighlightBtn.style.display = 'none';
    }
  });
}

const clearTrafficBtn = document.getElementById("clear-traffic");
if (clearTrafficBtn) {
  clearTrafficBtn.addEventListener("click", () => {
    isFreeTrafficEnabled = false;
    toggleFreeTraffic(false);
    if (toggleTrafficBtn) {
      toggleTrafficBtn.textContent = "🚦 Trafik Real (FALAS)";
      toggleTrafficBtn.style.background = "transparent";
      toggleTrafficBtn.style.color = "var(--accent)";
    }
    trafficDataCache.clear();
    if (clearHighlightBtn) clearHighlightBtn.style.display = "none";
  });
}

const startNavBtn = document.getElementById("start-nav");
if (startNavBtn) {
  startNavBtn.addEventListener("click", startNavigation);
}

const destinationInput = document.getElementById("destination-input");
if (destinationInput) {
  destinationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      startNavigation();
    }
  });
}

const departureTimeInput = document.getElementById("departure-time");
if (departureTimeInput) {
  departureTimeInput.addEventListener("change", (event) => {
    const timeValue = event.target.value;
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      const now = new Date();
      selectedDepartureTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      console.log("Koha e nisjes e zgjedhur:", selectedDepartureTime);
    } else {
      selectedDepartureTime = null;
    }
  });
}

setInterval(() => {
  const mapTime = document.getElementById("map-time");
  if (mapTime) {
    mapTime.textContent = formatTime(new Date());
  }
}, 60000);

// Bëj një refresh të parë për të mbushur të gjithë seksionet
refresh();
