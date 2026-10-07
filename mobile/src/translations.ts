export type MobileLanguage = 'en' | 'am' | 'or';

export interface MobileTranslations {
  appName: string;
  subTitle: string;
  tabAdvisory: string;
  tabGrid: string;
  tabEnso: string;
  cropLabel: string;
  leadLabel: string;
  iekLabel: string;
  iekAgree: string;
  iekDisagree: string;
  iekUncertain: string;
  strategy: string;
  planting: string;
  water: string;
  preparedness: string;
  confidence: string;
  refreshing: string;
  offlineMode: string;
  onlineMode: string;
  gridTitle: string;
  selectedCell: string;
  riskProbability: string;
  ensoTitle: string;
  ensoSummary: string;
  outlookTitle: string;
}

export const mobileTranslations: Record<MobileLanguage, MobileTranslations> = {
  en: {
    appName: 'AgriMinds AI-DREWS',
    subTitle: 'Choke Mountain Watershed · Mobile Advisor',
    tabAdvisory: '🌾 Advisory',
    tabGrid: '🗺️ Drought Grid',
    tabEnso: '🌡️ Climate ENSO',
    cropLabel: 'Select Staple Crop',
    leadLabel: 'Forecast Lead Horizon',
    iekLabel: 'Indigenous Knowledge (IEK)',
    iekAgree: '✓ Signs Dry',
    iekDisagree: '✕ Signs Wet',
    iekUncertain: 'Uncertain',
    strategy: 'Crop Strategy',
    planting: 'Planting Window',
    water: 'Water Management',
    preparedness: 'Preparedness Action',
    confidence: 'Confidence Rating',
    refreshing: 'Updating advisory...',
    offlineMode: 'Offline Cache Active',
    onlineMode: 'FastAPI Live Connected',
    gridTitle: '8×8 Watershed Risk Map',
    selectedCell: 'Selected Cell',
    riskProbability: 'Risk Probability',
    ensoTitle: 'ENSO Teleconnection',
    ensoSummary: 'Regional Impact',
    outlookTitle: '6-Month Niño 3.4 Outlook',
  },
  am: {
    appName: 'አግሪማይንድስ AI-DREWS',
    subTitle: 'የጮቄ ተራራ ተፋሰስ · የሞባይል አማካሪ',
    tabAdvisory: '🌾 ምክረ ሃሳብ',
    tabGrid: '🗺️ የድርቅ ካርታ',
    tabEnso: '🌡️ የአየር ንብረት',
    cropLabel: 'ዋነኛ ሰብል ይምረጡ',
    leadLabel: 'የትንበያ ጊዜ',
    iekLabel: 'የአካባቢ ባህላዊ እውቀት (IEK)',
    iekAgree: '✓ ድርቅ ያሳያል',
    iekDisagree: '✕ ዝናብ ያሳያል',
    iekUncertain: 'እርግጠኛ አይደለሁም',
    strategy: 'የሰብል ስትራቴጂ',
    planting: 'የመዝሪያ ወቅት',
    water: 'የውሃና እርጥበት አያያዝ',
    preparedness: 'ቅድመ ዝግጅት እርምጃ',
    confidence: 'የእርግጠኝነት ደረጃ',
    refreshing: 'መረጃ በማደስ ላይ...',
    offlineMode: 'ከመስመር ውጭ (መሸጎጫ)',
    onlineMode: 'ቀጥታ ግንኙነት ተሳክቷል',
    gridTitle: '8×8 የተፋሰሱ ድርቅ ካርታ',
    selectedCell: 'የተመረጠ እርሻ ቦታ',
    riskProbability: 'የአደጋ እድል',
    ensoTitle: 'የኤል ኒኞ ሁኔታ',
    ensoSummary: 'የአካባቢው የአየር ንብረት ተፅእኖ',
    outlookTitle: 'የ 6 ወራት የኒኞ 3.4 እይታ',
  },
  or: {
    appName: 'AgriMinds AI-DREWS',
    subTitle: 'Lolaa Gaara Choke · Gorsa Moobaayilaa',
    tabAdvisory: '🌾 Gorsa Qonnaa',
    tabGrid: '🗺️ Kaartaa Hongee',
    tabEnso: '🌡️ Qilleensa ENSO',
    cropLabel: 'Midhaan Filadhu',
    leadLabel: 'Waqtii Raagaa',
    iekLabel: 'Beekumsa Aadaa Naannoo (IEK)',
    iekAgree: '✓ Hongee Mul\'isa',
    iekDisagree: '✕ Rooba Mul\'isa',
    iekUncertain: 'Hinhikamin',
    strategy: 'Tarsiimoo Midhaanii',
    planting: 'Waqtii Facaasaa',
    water: 'Bulchiinsa Bishaanii',
    preparedness: 'Qophii Duraa',
    confidence: 'Sadarkaa Amanamummaa',
    refreshing: 'Haaromsaa jira...',
    offlineMode: 'Tooraan Alaa (Cache)',
    onlineMode: 'Toora Irra Jira (Live)',
    gridTitle: 'Kaartaa Sodaa Hongee 8×8',
    selectedCell: 'Qotiisa Filatame',
    riskProbability: 'Carraa Sodaa',
    ensoTitle: 'Haala Qilleensa ENSO',
    ensoSummary: 'Dhiibbaa Naannoo',
    outlookTitle: 'Raaga Ji\'a 6 Niño 3.4',
  },
};
