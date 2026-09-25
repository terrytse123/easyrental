export const DISTRICTS = [
  { id: "Central and Western", zh: "中西區", region: "hk" },
  { id: "Wan Chai", zh: "灣仔", region: "hk" },
  { id: "Eastern", zh: "東區", region: "hk" },
  { id: "Southern", zh: "南區", region: "hk" },
  { id: "Yau Tsim Mong", zh: "油尖旺", region: "kln" },
  { id: "Sham Shui Po", zh: "深水埗", region: "kln" },
  { id: "Kowloon City", zh: "九龍城", region: "kln" },
  { id: "Wong Tai Sin", zh: "黃大仙", region: "kln" },
  { id: "Kwun Tong", zh: "觀塘", region: "kln" },
  { id: "Kwai Tsing", zh: "葵青", region: "nt" },
  { id: "Tsuen Wan", zh: "荃灣", region: "nt" },
  { id: "Tuen Mun", zh: "屯門", region: "nt" },
  { id: "Yuen Long", zh: "元朗", region: "nt" },
  { id: "North", zh: "北區", region: "nt" },
  { id: "Tai Po", zh: "大埔", region: "nt" },
  { id: "Sha Tin", zh: "沙田", region: "nt" },
  { id: "Sai Kung", zh: "西貢", region: "nt" },
  { id: "Islands", zh: "離島", region: "nt" },
] as const;

export const PROPERTY_TYPES = [
  { id: "private", zh: "私人住宅", en: "Private flat" },
  { id: "hosa", zh: "居屋", en: "HOS" },
  { id: "public", zh: "公屋", en: "Public housing" },
  { id: "village", zh: "村屋", en: "Village house" },
  { id: "shop", zh: "舖位", en: "Shop" },
  { id: "parking", zh: "車位", en: "Parking" },
  { id: "serviced", zh: "服務式住宅", en: "Serviced" },
] as const;

export const PAY_METHODS = [
  { id: "fps", zh: "轉數快", en: "FPS" },
  { id: "bank", zh: "銀行轉帳", en: "Bank transfer" },
  { id: "payme", zh: "PayMe", en: "PayMe" },
  { id: "alipay", zh: "AlipayHK", en: "AlipayHK" },
  { id: "wechat", zh: "微信支付", en: "WeChat Pay" },
  { id: "cheque", zh: "支票", en: "Cheque" },
  { id: "cash", zh: "現金", en: "Cash" },
] as const;
