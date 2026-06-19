/**
 * StrAct Z - Centralized District Registry
 * This file is the single source of truth for all district metadata.
 */

const DISTRICTS = [
  { key: 'hoan_kiem', name: 'Hoàn Kiếm', lat: 21.0300, lng: 105.8551, radiusKm: 1.2, groups: ['urban', 'default'] },
  { key: 'hai_ba_trung', name: 'Hai Bà Trưng', lat: 21.0064, lng: 105.8624, radiusKm: 2.0, groups: ['urban', 'default'] },
  { key: 'hoang_mai', name: 'Hoàng Mai', lat: 20.9749, lng: 105.8579, radiusKm: 2.8, groups: ['urban', 'default'] },
  { key: 'dong_da', name: 'Đống Đa', lat: 21.0148, lng: 105.8207, radiusKm: 1.8, groups: ['urban', 'default'] },
  { key: 'ba_dinh', name: 'Ba Đình', lat: 21.0349, lng: 105.8293, radiusKm: 1.5, groups: ['urban', 'default'] },
  { key: 'thanh_xuan', name: 'Thanh Xuân', lat: 20.9945, lng: 105.8171, radiusKm: 1.8, groups: ['urban', 'default'] },
  { key: 'cau_giay', name: 'Cầu Giấy', lat: 21.0300, lng: 105.7912, radiusKm: 2.0, groups: ['urban', 'default'] },
  { key: 'tay_ho', name: 'Tây Hồ', lat: 21.0685, lng: 105.8211, radiusKm: 2.2, groups: ['urban', 'default'] },
  { key: 'long_bien', name: 'Long Biên', lat: 21.0383, lng: 105.8875, radiusKm: 2.5, groups: ['urban', 'default'] },
  { key: 'ha_dong', name: 'Hà Đông', lat: 20.9700, lng: 105.7700, radiusKm: 3.5, groups: ['urban', 'default'] },
  { key: 'bac_tu_liem', name: 'Bắc Từ Liêm', lat: 21.0728, lng: 105.7618, radiusKm: 2.5, groups: ['urban'] },
  { key: 'nam_tu_liem', name: 'Nam Từ Liêm', lat: 21.0181, lng: 105.7627, radiusKm: 2.2, groups: ['urban'] },

  // ─── Suburban Districts (Huyện) ───────────────────────────────────────────
  { key: 'thanh_tri', name: 'Thanh Trì', lat: 20.9451, lng: 105.8445, radiusKm: 3.5, groups: ['suburban'] },
  { key: 'gia_lam', name: 'Gia Lâm', lat: 21.0195, lng: 105.9377, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'dong_anh', name: 'Đông Anh', lat: 21.1414, lng: 105.8449, radiusKm: 5.0, groups: ['suburban'] },
  { key: 'hoai_duc', name: 'Hoài Đức', lat: 21.0699, lng: 105.7077, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'dan_phuong', name: 'Đan Phượng', lat: 21.1076, lng: 105.6751, radiusKm: 3.5, groups: ['suburban'] },
  { key: 'chuong_my', name: 'Chương Mỹ', lat: 20.9241, lng: 105.7041, radiusKm: 6.0, groups: ['suburban'] },
  { key: 'thanh_oai', name: 'Thanh Oai', lat: 20.8920, lng: 105.7830, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'thuong_tin', name: 'Thường Tín', lat: 20.8500, lng: 105.9000, radiusKm: 5.0, groups: ['suburban'] },
  { key: 'ngoai_tinh', name: 'Ngoại tỉnh', lat: 21.0300, lng: 105.8551, radiusKm: 0.1, groups: ['suburban'] }
];

const ADJACENT_DISTRICTS = {
  'hoan_kiem': ['ba_dinh', 'hai_ba_trung', 'dong_da', 'long_bien'],
  'ba_dinh': ['hoan_kiem', 'dong_da', 'cau_giay', 'tay_ho', 'long_bien'],
  'dong_da': ['ba_dinh', 'hoan_kiem', 'hai_ba_trung', 'thanh_xuan', 'cau_giay'],
  'hai_ba_trung': ['hoan_kiem', 'dong_da', 'thanh_xuan', 'hoang_mai', 'long_bien'],
  'hoang_mai': ['hai_ba_trung', 'thanh_xuan', 'long_bien', 'thanh_tri'],
  'thanh_xuan': ['dong_da', 'hai_ba_trung', 'hoang_mai', 'cau_giay', 'ha_dong', 'nam_tu_liem', 'thanh_tri'],
  'cau_giay': ['ba_dinh', 'dong_da', 'thanh_xuan', 'tay_ho', 'nam_tu_liem', 'bac_tu_liem'],
  'tay_ho': ['ba_dinh', 'cau_giay', 'bac_tu_liem', 'long_bien', 'dong_anh'],
  'long_bien': ['tay_ho', 'ba_dinh', 'hoan_kiem', 'hai_ba_trung', 'hoang_mai', 'gia_lam', 'dong_anh'],
  'ha_dong': ['thanh_xuan', 'nam_tu_liem', 'thanh_tri', 'thanh_oai', 'chuong_my', 'hoai_duc'],
  'bac_tu_liem': ['tay_ho', 'cau_giay', 'nam_tu_liem', 'hoai_duc', 'dan_phuong', 'dong_anh'],
  'nam_tu_liem': ['cau_giay', 'thanh_xuan', 'ha_dong', 'bac_tu_liem', 'hoai_duc'],
  'thanh_tri': ['hoang_mai', 'thanh_xuan', 'ha_dong', 'thanh_oai', 'thuong_tin', 'gia_lam'],
  'gia_lam': ['long_bien', 'dong_anh', 'thanh_tri', 'thuong_tin'],
  'dong_anh': ['tay_ho', 'long_bien', 'gia_lam', 'bac_tu_liem', 'dan_phuong'],
  'hoai_duc': ['bac_tu_liem', 'nam_tu_liem', 'ha_dong', 'dan_phuong', 'chuong_my'],
  'dan_phuong': ['bac_tu_liem', 'hoai_duc', 'dong_anh'],
  'chuong_my': ['ha_dong', 'hoai_duc', 'thanh_oai'],
  'thanh_oai': ['ha_dong', 'chuong_my', 'thanh_tri', 'thuong_tin'],
  'thuong_tin': ['thanh_tri', 'thanh_oai', 'gia_lam']
};

module.exports = {
  DISTRICTS,
  ADJACENT_DISTRICTS,
  getByKey: (key) => DISTRICTS.find(d => d.key === key),
  getByGroup: (group) => DISTRICTS.filter(d => d.groups && d.groups.includes(group)),
  getDefaultKeys: () => DISTRICTS.filter(d => d.groups && d.groups.includes('default')).map(d => d.key),
  getAllKeys: () => DISTRICTS.map(d => d.key)
};
