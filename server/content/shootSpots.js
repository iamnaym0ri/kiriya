// Singapore photoshoot spots, verified by hand against official pages on 2026-09-15 (home WSL
// machine). `permit.quote`, `status.quote` and `rules` are verbatim page text (whitespace collapsed);
// `permit.summary` is a plain paraphrase. Every entry in `rules` comes from `rulesSourceUrl`; status
// and permit quotes carry their own source. `goodFor` and `idea` are authored suggestions only and make
// no factual claims. Spots whose status or rules could not be verified were left out (Boat Quay,
// Sentosa Boardwalk, Punggol Point Park – closed for upgrading until 31 Dec 27 – Bukit Batok Nature
// Park – trail closed for maintenance – and the 2020 studio list). No primary source was found for
// the "wrap replica props" guidance, so it is not included.
//
// Official pages are verified by hand; the feed adapter never fetches them (NParks' terms forbid
// automated monitoring or copying). Re-verify before `verifiedAt` is 180 days old; the adapter stops
// serving stale entries.

const NPARKS = "National Parks Board (NParks)";
const JLG_PERMIT = "https://juronglakegardens.nparks.gov.sg/apply-for-a-permit/";
const JLG_HOURS = "https://juronglakegardens.nparks.gov.sg/operating-hours-and-services/";
const NPARKS_FILMING = "https://www.nparks.gov.sg/services/apply-on-location-filming-permit";

const JLG_PERMIT_FACTS = {
  summary:
    "Casual photography needs no submission. Filming and commercial photography need prior NParks approval (apply at least 14 days ahead), and structures or props need approval too.",
  quote:
    "Prior approval for filming and commercial photography in the Gardens is required. Casual photography sessions (such as family portraits and graduations) do not require submission.",
  sourceUrl: JLG_PERMIT,
  verifiedAt: "2026-09-15T15:22:00Z",
};
const JLG_RULES = [
  "Please do not set up any structures or props without the prior approval of NParks.",
  "Filming and photography are NOT allowed at Clusia Cove, Forest Ramble and Entrance Pavilion for the convenience of other visitors.",
  "Lighting, including flash, is not allowed to protect the biodiversity.",
];

export const SHOOT_SPOTS = [
  {
    id: "jlg-chinese-garden",
    name: "Chinese Garden, Jurong Lake Gardens",
    area: "Jurong Lake Gardens, Jurong East",
    organisation: NPARKS,
    officialUrl: "https://juronglakegardens.nparks.gov.sg/chinese-gardens/",
    status: {
      state: "open",
      quote: "Chinese Garden (Open from 5.30am to 12am daily)",
      sourceUrl: JLG_HOURS,
      verifiedAt: "2026-09-15T15:24:00Z",
    },
    permit: JLG_PERMIT_FACTS,
    rules: JLG_RULES,
    rulesSourceUrl: JLG_PERMIT,
    goodFor: ["maomao", "jinshi", "the apothecary diaries"],
    idea: "idea: maomao on a herb-gathering errand between the pagodas and bamboo, everything handheld and low-key.",
    verifiedAt: "2026-09-15T15:24:00Z",
  },
  {
    id: "jlg-japanese-garden",
    name: "Japanese Garden, Jurong Lake Gardens",
    area: "Jurong Lake Gardens, Jurong East",
    organisation: NPARKS,
    officialUrl: "https://juronglakegardens.nparks.gov.sg/japanese-garden/",
    status: {
      state: "open",
      quote: "Japanese Garden (Open from 5.30am to 12am daily)",
      sourceUrl: JLG_HOURS,
      verifiedAt: "2026-09-15T15:24:00Z",
    },
    permit: JLG_PERMIT_FACTS,
    rules: JLG_RULES,
    rulesSourceUrl: JLG_PERMIT,
    goodFor: ["frieren", "fern"],
    idea: "idea: a slow frieren and fern stroll by the water gardens, soft natural light and no flash.",
    verifiedAt: "2026-09-15T15:24:00Z",
  },
  {
    id: "singapore-botanic-gardens",
    name: "Singapore Botanic Gardens",
    area: "Tanglin",
    organisation: NPARKS,
    officialUrl: "https://sbg.nparks.gov.sg/visit/use-our-space/",
    status: {
      state: "open",
      quote: "Opening Hours Gardens 5am to 12mn daily",
      sourceUrl: "https://sbg.nparks.gov.sg/visit/general-info/",
      verifiedAt: "2026-09-15T15:38:00Z",
    },
    permit: {
      summary:
        "Casual photography sessions need no submission. Filming for documentaries and media needs an online application at least 14 days ahead.",
      quote: "Casual photography sessions (such as family portraits and graduations) do not require submission.",
      sourceUrl: "https://sbg.nparks.gov.sg/visit/use-our-space/",
      verifiedAt: "2026-09-15T15:18:00Z",
    },
    rules: [
      "Do not set up tents or furniture, nor obstruct any path or visitor access",
      "Do not play ball/racquet games, frisbees, fly model aircraft/drones and kites",
      "Filming for documentaries and media require an online application at least 14-days prior",
    ],
    rulesSourceUrl: "https://sbg.nparks.gov.sg/visit/use-our-space/",
    goodFor: ["coco", "witch hat atelier"],
    idea: "idea: coco on a sketch walk under the big old trees, sketchbook in hand and nothing set up on the paths.",
    verifiedAt: "2026-09-15T15:38:00Z",
  },
  {
    id: "gardens-by-the-bay",
    name: "Gardens by the Bay (outdoor gardens)",
    area: "Marina Bay",
    organisation: "Gardens by the Bay",
    officialUrl: "https://www.gardensbythebay.com.sg/en/plan-your-visit/visiting-guidelines.html",
    status: {
      state: "open",
      quote:
        "Outdoor Gardens (Outdoor gardens include: Serene Garden, Supertree Grove, Sun Pavillion, Heritage Gardens, World of Plants, Dragonfly & Kingfisher Lakes) Opening Hours Daily: 5.00am – 2.00am",
      sourceUrl: "https://www.gardensbythebay.com.sg/en/plan-your-visit/opening-hours.html",
      verifiedAt: "2026-09-15T15:37:00Z",
    },
    permit: {
      summary:
        "Photography for personal memories is welcome. Commercial filming and photography need prior approval (apply at least 14 days ahead). No tripods on weekends and public holidays.",
      quote: "Filming and photography for your personal memories are welcome.",
      sourceUrl: "https://www.gardensbythebay.com.sg/en/plan-your-visit/visiting-guidelines.html",
      verifiedAt: "2026-09-15T15:27:00Z",
    },
    rules: [
      "To ensure the safety and enjoyment of our visitors, usage of tripods are not allowed in the Gardens on weekends and public holiday.",
      "Prior approval is required for commercial filming and photography.",
      "the use of remote-controlled aerial cameras (including drones), planes, helicopters and other similar devices are not allowed at Bay Central, Bay East and Bay South gardens.",
    ],
    rulesSourceUrl: "https://www.gardensbythebay.com.sg/en/plan-your-visit/visiting-guidelines.html",
    goodFor: ["hatsune miku", "project sekai"],
    idea: "idea: a futuristic miku look under the supertrees at blue hour, handheld only if it's a weekend.",
    verifiedAt: "2026-09-15T15:37:00Z",
  },
  {
    id: "fort-canning-park",
    name: "Fort Canning Park",
    area: "Dhoby Ghaut / Clarke Quay",
    organisation: NPARKS,
    officialUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/fort-canning-park",
    status: {
      state: "open",
      quote: "Opening hours Open 24 hours",
      sourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/fort-canning-park",
      verifiedAt: "2026-09-15T15:29:00Z",
    },
    permit: {
      summary:
        "The park page asks for a Park Use Request form for photography & filming and group activities, and points filming requests to NParks' on-location filming permit. Tree Tunnel requests go to the LTA.",
      quote:
        "Please fill in this Park Use Request form for all group activities, photography & filming, and solemnization/ proposal requests at Fort Canning Park.",
      sourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/fort-canning-park",
      verifiedAt: "2026-09-15T15:29:00Z",
    },
    rules: [
      "For requests relating to Fort Canning Tree Tunnel, please contact the Land Transport Authority.",
      "For filming and photography requests, please use the Apply for on-location filming permit",
    ],
    rulesSourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/fort-canning-park",
    goodFor: ["frieren", "fern"],
    idea: "idea: an adventurer-party frieren set near the old fort gate; send the park's request form before planning it.",
    verifiedAt: "2026-09-15T15:29:00Z",
  },
  {
    id: "hortpark",
    name: "HortPark",
    area: "Alexandra / Southern Ridges",
    organisation: NPARKS,
    officialUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/hortpark",
    status: {
      state: "open",
      quote: "Opening hours 6am to 11pm",
      sourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/hortpark",
      verifiedAt: "2026-09-15T15:29:00Z",
    },
    permit: {
      summary:
        "On-location filming at HortPark needs an application at least 2 weeks ahead. NParks requires a permit for all filming and commercial photography, and HortPark is outside its small-scale permit.",
      quote:
        "Apply for on-location filming in HortPark. Please note that applications have to be submitted at least 2 weeks before the intended filming date.",
      sourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/hortpark",
      verifiedAt: "2026-09-15T15:29:00Z",
    },
    rules: [
      "If you wish to fly your drone at the HortLawn, Hort Centre, or the Silver Garden within HortPark, you will have to apply for drone usage at least 2 weeks before the intended flying date.",
      "Applications submitted less than 2 weeks in advance will not be considered.",
    ],
    rulesSourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/hortpark",
    goodFor: ["coco", "witch hat atelier"],
    idea: "idea: coco's first day as an apprentice, wandering the themed gardens with a sketchbook.",
    verifiedAt: "2026-09-15T15:29:00Z",
  },
  {
    id: "labrador-nature-reserve",
    name: "Labrador Nature Reserve and Nature Park",
    area: "Labrador Park / Pasir Panjang",
    organisation: NPARKS,
    officialUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/labrador-nature-reserve",
    status: {
      state: "partly_closed",
      quote: "For public safety, the Casemate and the Rocky Shore are closed.",
      sourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/labrador-nature-reserve",
      verifiedAt: "2026-09-15T15:29:00Z",
    },
    permit: {
      summary:
        "NParks requires a permit for all filming and commercial photography, and filming requests in nature reserves are reviewed strictly, case by case. No cycling or drones.",
      quote: "Filming requests in our nature reserves and nature parks are reviewed stringently and approved on a case-by-case basis.",
      sourceUrl: NPARKS_FILMING,
      verifiedAt: "2026-09-15T15:16:00Z",
    },
    rules: [
      "Do not cycle or fly drones.",
      "Berlayar Creek boardwalk at Labrador Nature Park will be closed for improvement works from 3 Jun 26 till 31 Mar 27.",
      "Opening hours Open 24 hours (except nature reserve section: 7am to 7pm)",
    ],
    rulesSourceUrl: "https://www.nparks.gov.sg/visit/parks/park-detail/labrador-nature-reserve",
    goodFor: ["frieren", "fern"],
    idea: "idea: frieren and fern finding old ruins in a coastal forest, kept small and quiet on the open trails.",
    verifiedAt: "2026-09-15T15:29:00Z",
  },
  {
    id: "marina-barrage",
    name: "Marina Barrage (Green Roof)",
    area: "Marina South",
    organisation: "PUB, Singapore's National Water Agency",
    officialUrl: "https://www.pub.gov.sg/Public/Places-of-Interest/Marina-Barrage",
    status: {
      state: "open",
      quote:
        "The public areas at Marina Barrage and the Green Roof are open for 24 hours except for the following locations: Water Playground Sustainable Singapore Gallery",
      sourceUrl: "https://www.pub.gov.sg/Public/Places-of-Interest/Marina-Barrage/Visitors-Information",
      verifiedAt: "2026-09-15T15:33:00Z",
    },
    permit: {
      summary:
        "PUB requires a permit or prior approval for commercial filming and photography at its premises, which include Marina Barrage. Aerial shoots also need a CAAS drone permit first.",
      quote: "A permit or prior approval is required for doing commercial filming and photography in PUB premises.",
      sourceUrl: "https://www.pub.gov.sg/Public/Places-of-Interest/Filming-and-Photography",
      verifiedAt: "2026-09-15T15:32:00Z",
    },
    rules: [
      "If you are doing an aerial shoot, please also request for an unmanned aircraft (drone) operator flying permit from CAAS prior to applying for a filming/photography permit with PUB.",
    ],
    rulesSourceUrl: "https://www.pub.gov.sg/Public/Places-of-Interest/Filming-and-Photography",
    goodFor: ["hatsune miku", "project sekai"],
    idea: "idea: a city-lights miku or sekai street look on the green roof at dusk, all handheld.",
    verifiedAt: "2026-09-15T15:33:00Z",
  },
];
