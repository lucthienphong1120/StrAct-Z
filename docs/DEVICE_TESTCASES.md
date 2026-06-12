# Device Verification Testcases - StrAct Z
2: 
3: Use this file to track testing of various devices and applications on Strava. Update their statuses as you perform tests.
4: 
5: ## 📋 Device Testcases
6: 
7: | Source / Device Name | Manufacturer ID | Product ID | Tested Status |
8: | :--- | :--- | :--- | :--- |
9: | **Garmin Forerunner 965** | 1 | 4315 | Fit OK |
10: | **Garmin Forerunner 955** | 1 | 4024 | Fit OK |
11: | **Garmin Forerunner 745** | 1 | 3589 | Fit OK |
12: | **Garmin Forerunner 265** | 1 | 4257 | Fit OK |
13: | **Garmin Forerunner 255** | 1 | 3992 | Fit OK |
14: | **Garmin Forerunner 255S** | 1 | 3993 | Fit OK |
15: | **Garmin Forerunner 165** | 1 | 4432 | Fit OK |
16: | **Garmin fēnix 7x Pro** | 1 | 4376 | Fit OK |
17: | **Garmin fēnix 8** | 1 | 4536 | Fit OK |
18: | **Garmin fēnix 8 Solar** | 1 | 4533 | Fit OK |
19: | **Garmin fēnix E** | 1 | 4666 | Fit OK |
20: | **Garmin Enduro 3** | 1 | 4575 | Fit OK |
21: | **Garmin Venu 3** | 1 | 4260 | Fit OK |
22: | **Garmin Venu 3S** | 1 | 4261 | Fit OK |
23: | **Garmin Venu 2** | 1 | 3703 | Fit OK |
24: | **Garmin Venu 2S** | 1 | 3704 | Fit OK |
25: | **Garmin Venu 2 Plus** | 1 | 3851 | Fit OK |
26: | **Garmin Venu Sq 2** | 1 | 4115 | Fit OK |
27: | **Garmin Instinct 2X Solar** | 1 | 4394 | Fit OK |
28: | **Garmin epix Pro (Gen 2) 47mm** | 1 | 4313 | Fit OK |
29: | **Garmin Connect** | 1 | ? | GPX OK |
30: | **Coros Pace 3** | 294 | ? | GPX OK |
31: | **Coros Apex 2 Pro** | 294 | ? | GPX OK |
32: | **Coros Vertix 2S** | 294 | ? | GPX OK |
33: | **COROS** | 294 | ? | GPX OK |
34: | **Suunto Vertical** | 23 | ? | GPX OK |
35: | **Suunto Race** | 23 | ? | Chưa test |
36: | **Suunto Ocean** | 23 | ? | Chưa test |
37: | **Suunto 9 Peak Pro** | 23 | ? | Chưa test |
38: | **Amazfit Bip 6** | 339 | ? | Chưa test |
39: | **Amazfit Cheetah** | 339 | ? | Chưa test |
40: | **Amazfit T-Rex 3** | 339 | ? | GPX OK |
41: | **Amazfit GTR 4** | 339 | ? | Chưa test |
42: | **Amazfit Balance 2** | 339 | ? | GPX OK |
43: | **Amazfit Active 2** | 339 | ? | Chưa test |
44: | **Amazfit Active 3 Premium** | 339 | ? | GPX OK |
45: | **Huawei Watch GT 6 Pro** | 348 | ? | GPX OK |
46: | **Huawei Watch GT 6** | 348 | ? | GPX OK |
47: | **Huawei Watch Fit 5 Pro** | 348 | ? | GPX OK |
48: | **Huawei Watch Fit 5** | 348 | ? | GPX OK |
49: | **Huawei Watch Fit 4 Pro** | 348 | ? | GPX OK |
50: | **Huawei Watch Fit 4** | 348 | ? | GPX OK |
51: | **Huawei Watch GT 5** | 348 | ? | GPX OK |
52: | **Huawei Watch GT 5 Pro** | 348 | ? | GPX OK |
53: | **Huawei Watch 5** | 348 | ? | GPX OK |
54: | **Huawei Watch D2** | 348 | ? | GPX OK |
55: | **Huawei Watch Ultimate 2** | 348 | ? | GPX OK |
56: | **Huawei Watch Kids** | 348 | ? | GPX OK |
57: | **Huawei Watch Ultimate** | 348 | ? | GPX OK |
58: | **Huawei Health** | 348 | ? | GPX OK |
59: | **Samsung Health** | 258 | ? | GPX OK |
60: | **Polar Vantage V3** | ? | ? | Chưa test |
61: | **Polar Grit X2 Pro** | ? | ? | Chưa test |
62: | **Polar Pacer** | ? | ? | Chưa test |
63: | **Polar Pacer Pro** | ? | ? | Chưa test |
64: | **Polar Ignite 3** | ? | ? | Chưa test |
65: | **Xiaomi Watch S5** | ? | ? | Chưa test |
66: | **Xiaomi Watch 2** | ? | ? | Chưa test |
67: | **Xiaomi Smart Band 10** | ? | ? | Chưa test |
68: | **Redmi Watch 6** | ? | ? | Chưa test |
69: | **Redmi Watch 5 Active** | ? | ? | Chưa test |
70: | **Strava App** | 265 | 265 | GPX OK |
71: 
72: ### Phương án triển khai sau khi Test
73: 
74: Với thiết bị Garmin:
75: ```
76: Type: Fit
77: Source: Manufactor/Device ID
78: Description:
79: hoặc
80: Type: GPX
81: Source: Garmin Connect
82: Description: Device name
83: ```
84: 
85: Với thiết bị Huawei/COROS:
86: ```
87: Type: GPX
88: Source: Huawei Health / COROS
89: Description: Device name
90: ```
91: 
92: Với thiết vị Suunto/Amazfit:
93: ```
94: Type: GPX
95: Source: Device name
96: Description: 
97: ```
98: 
99: Với các thiết bị Polar/Xiaomi:
100: ```
101: Thêm một vài dòng làm testcase
102: ```
103: 
104: ## 🔍 Kết quả nghiên cứu & Ánh xạ ID từ Garmin FIT SDK & ANT+
105: 
106: Dựa trên tài liệu chính thống của **Garmin FIT SDK** và **ANT+ Alliance (thisisant.com)**, dưới đây là các phát hiện quan trọng phục vụ cho việc sinh tệp FIT chuẩn hóa trên hệ thống:
107: 
108: ### 1. Cơ chế ánh xạ Thiết bị (Device Mapping Rule)
109: * **Manufacturer ID (Mã nhà sản xuất)**: Được cấp phát độc quyền bởi ANT+ Alliance cho các hãng thành viên. Việc gửi đúng ID này là điều kiện tiên quyết để Strava hiển thị đúng logo thương hiệu và Sync Badge của ứng dụng kết nối tương ứng (ví dụ: `Zepp App` cho Amazfit, `Huawei Health` cho Huawei).
110: * **Product ID (Mã sản phẩm)**:
111:   * **Đối với Garmin (Manufacturer = 1)**: FIT SDK định nghĩa một danh sách Enum cụ thể (gọi là `garmin_product`). Gửi đúng mã sản phẩm (ví dụ: `4376` cho fēnix 7x Pro, `4315` cho Forerunner 965) sẽ giúp Strava map trực tiếp thiết bị đó từ database.
112:   * **Đối với các hãng phi-Garmin (Huawei, Coros, Amazfit, Suunto)**: ANT+ không quản lý Product ID của họ trong FIT SDK. 
113:   * **Bí quyết map thiết bị phi-Garmin**: Khi tạo tệp FIT, nếu thuộc tính `product` được bỏ qua hoặc để `undefined` trong message `file_id` and `device_info`, Strava sẽ tự động kích hoạt cơ chế Fallback: đối chiếu dựa trên thuộc tính **`product_name`** trong message **`device_info`** để hiển thị đúng tên thiết bị trên giao diện. Điều này giúp sửa lỗi thiết bị phi-Garmin bị nhận diện sai hoặc bị ẩn tên.
114: 
115: ### 2. Các tham số định danh chuẩn theo tài liệu FIT SDK
116: Dưới đây là danh sách Manufacturer ID & Product ID chuẩn hóa cho các dòng thiết bị phổ biến đã được tích hợp vào hệ thống:
117: 
118: * **Garmin (Manufacturer: 1)**
119:   * fēnix 7: `3906` | fēnix 7x Pro: `4376`
120:   * fēnix 8: `4536` | fēnix 8 Solar: `4533`
121:   * Forerunner 945: `3113` | Forerunner 935: `2691`
122:   * Forerunner 955: `4024` | Forerunner 965: `4315`
123:   * Forerunner 255: `3992` | Forerunner 255S: `3993`
124:   * Forerunner 265: `4257` | Forerunner 165: `4432`
125:   * Venu 2: `3703` | Venu 2S: `3704` | Venu 2 Plus: `3851` | Venu Sq 2: `4115`
126:   * Instinct 2X Solar: `4394` | Epix Pro (Gen 2): `4313`
127:   * Garmin Connect app: `undefined` (hiển thị nguồn đồng bộ chung của Garmin)
128: * **COROS (Manufacturer: 294)**
129:   * Product: `undefined` | Thiết bị: Pace 3, Apex 2 Pro, Vertix 2S (nhận diện qua tên thiết bị)
130: * **Amazfit / Zepp (Manufacturer: 339)**
131:   * Product: `undefined` | Thiết bị: T-Rex 3, Balance 2, Active (nhận diện qua tên thiết bị)
132: * **Huawei (Manufacturer: 348)**
133:   * Product: `undefined` | Thiết bị: Watch GT 6 Pro, Watch Fit 5 Pro, Watch Fit 3 (nhận diện qua tên thiết bị)
134: * **Suunto (Manufacturer: 23)**
135:   * Product: `undefined` | Thiết bị: Vertical (nhận diện qua tên thiết bị)
136: * **Strava (Manufacturer: 265)**
137:   * Product: `265` (Dành cho các hoạt động ghi nhận trực tiếp bằng ứng dụng Strava)
138: 
139: ### 3. Chuẩn hóa thời gian (Time Standard) trong tệp FIT
140: * Mọi timestamp trong tệp FIT (`time_created`, `start_time`, `timestamp`) bắt buộc phải theo định dạng **giây kể từ kỷ nguyên FIT epoch** (00:00:00 UTC ngày 31/12/1989).
141: * Để Strava hiểu đúng múi giờ hiển thị của hoạt động, message `activity` cần ghi nhận thuộc tính `local_timestamp`. Đây là thời gian local tính bằng giây từ FIT epoch (bằng thời gian UTC cộng thêm offset múi giờ). Với múi giờ Việt Nam (GMT+7), công thức `local_timestamp = start_time + 7 * 3600` đang được áp dụng chuẩn xác.
