/**
 * StrAct Z - Centralized District Registry
 * This file is the single source of truth for all district metadata.
 */

const DISTRICTS = [
  { key: 'hoan_kiem',    name: 'Hoàn Kiếm',    lat: 21.0300, lng: 105.8551, radiusKm: 1.2, groups: ['urban', 'default'] },
  { key: 'hai_ba_trung', name: 'Hai Bà Trưng', lat: 21.0064, lng: 105.8624, radiusKm: 2.0, groups: ['urban', 'default'] },
  { key: 'hoang_mai',    name: 'Hoàng Mai',    lat: 20.9749, lng: 105.8579, radiusKm: 2.8, groups: ['urban', 'default'] },
  { key: 'dong_da',      name: 'Đống Đa',      lat: 21.0148, lng: 105.8207, radiusKm: 1.8, groups: ['urban', 'default'] },
  { key: 'ba_dinh',      name: 'Ba Đình',      lat: 21.0349, lng: 105.8293, radiusKm: 1.5, groups: ['urban', 'default'] },
  { key: 'thanh_xuan',   name: 'Thanh Xuân',   lat: 20.9945, lng: 105.8171, radiusKm: 1.8, groups: ['urban', 'default'] },
  { key: 'cau_giay',     name: 'Cầu Giấy',     lat: 21.0300, lng: 105.7912, radiusKm: 2.0, groups: ['urban', 'default'] },
  { key: 'tay_ho',       name: 'Tây Hồ',       lat: 21.0685, lng: 105.8211, radiusKm: 2.2, groups: ['urban', 'default'] },
  { key: 'long_bien',    name: 'Long Biên',    lat: 21.0383, lng: 105.8875, radiusKm: 2.5, groups: ['urban', 'default'] },
  { key: 'ha_dong',      name: 'Hà Đông',      lat: 20.9700, lng: 105.7700, radiusKm: 3.5, groups: ['urban', 'default'] },
  { key: 'bac_tu_liem',  name: 'Bắc Từ Liêm',  lat: 21.0728, lng: 105.7618, radiusKm: 2.5, groups: ['urban'] },
  { key: 'nam_tu_liem',  name: 'Nam Từ Liêm',  lat: 21.0181, lng: 105.7627, radiusKm: 2.2, groups: ['urban'] },
  
  // ─── Suburban Districts (Huyện) ───────────────────────────────────────────
  { key: 'thanh_tri',    name: 'Thanh Trì',    lat: 20.9451, lng: 105.8445, radiusKm: 3.5, groups: ['suburban'] },
  { key: 'gia_lam',      name: 'Gia Lâm',      lat: 21.0195, lng: 105.9377, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'dong_anh',     name: 'Đông Anh',     lat: 21.1414, lng: 105.8449, radiusKm: 5.0, groups: ['suburban'] },
  { key: 'soc_son',      name: 'Sóc Sơn',      lat: 21.2539, lng: 105.8494, radiusKm: 6.5, groups: ['suburban'] },
  { key: 'me_linh',      name: 'Mê Linh',      lat: 21.1846, lng: 105.7191, radiusKm: 5.5, groups: ['suburban'] },
  { key: 'hoai_duc',     name: 'Hoài Đức',     lat: 21.0699, lng: 105.7077, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'chuong_my',    name: 'Chương Mỹ',    lat: 20.9241, lng: 105.7041, radiusKm: 6.0, groups: ['suburban'] },
  { key: 'thanh_oai',    name: 'Thanh Oai',    lat: 20.8920, lng: 105.7830, radiusKm: 4.5, groups: ['suburban'] },
  { key: 'thach_that',   name: 'Thạch Thất',   lat: 21.0563, lng: 105.5759, radiusKm: 6.0, groups: ['suburban'] },
  { key: 'thuong_tin',   name: 'Thường Tín',   lat: 20.8500, lng: 105.9000, radiusKm: 5.0, groups: ['suburban'] },
  { key: 'ung_hoa',      name: 'Ứng Hòa',      lat: 20.7349, lng: 105.7707, radiusKm: 7.0, groups: ['suburban'] }
];

module.exports = {
  DISTRICTS,
  getByKey: (key) => DISTRICTS.find(d => d.key === key),
  getByGroup: (group) => DISTRICTS.filter(d => d.groups && d.groups.includes(group)),
  getDefaultKeys: () => DISTRICTS.filter(d => d.groups && d.groups.includes('default')).map(d => d.key),
  getAllKeys: () => DISTRICTS.map(d => d.key)
};
