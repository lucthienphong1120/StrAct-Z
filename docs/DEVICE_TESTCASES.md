# Device Verification Testcases - StrAct Z

Use this file to track testing of various devices and applications on Strava. Update their statuses as you perform tests.

## 📋 Device Testcases

| Source / Device Name | Manufacturer ID | Product ID | Tested Status |
| :--- | :--- | :--- | :--- |
| **Garmin Forerunner 965** | 1 | 4315 | Fit OK |
| **Garmin Forerunner 955** | 1 | 4024 | Fit OK - chưa có trong UI |
| **Garmin Forerunner 745** | 1 | 3589 | Fit OK |
| **Garmin Forerunner 265** | 1 | 4257 | Fit OK |
| **Garmin Forerunner 255** | 1 | 3992 | Fit OK |
| **Garmin Forerunner 255S** | 1 | 3993 | Fit OK |
| **Garmin Forerunner 165** | 1 | 4432 | Fit OK |
| **Garmin Forerunner 970** | 1 | ? | Không nhận thiết bị |
| **Garmin Forerunner 570** | 1 | ? | Không nhận thiết bị |
| **Garmin Instinct 3** | 1 | ? | Không nhận thiết bị |
| **Garmin fēnix 7x Pro** | 1 | 4376 | Fit OK |
| **Garmin fēnix 8** | 1 | 4536 | Fit OK |
| **Garmin fēnix 8 Solar** | 1 | 4533 | Fit OK |
| **Garmin fēnix E** | 1 | 4666 | Fit OK |
| **Garmin Enduro 3** | 1 | 4575 | Fit OK |
| **Garmin Venu 3** | 1 | 4260 | Fit OK |
| **Garmin Venu 3S** | 1 | 4261 | Fit OK |
| **Garmin Venu 2** | 1 | 3703 | - |
| **Garmin Venu 2S** | 1 | 3704 | - |
| **Garmin Venu 2 Plus** | 1 | 3851 | - |
| **Garmin Venu Sq 2** | 1 | 4115 | - |
| **Garmin Instinct 2X Solar** | 1 | 4394 | - |
| **Garmin epix Pro (Gen 2) 47mm** | 1 | 4313 | - |
| **Garmin Connect** | 1 | ? | - |
| **Coros Pace 3** | 294 | ? | - |
| **Coros Apex 2 Pro** | 294 | ? | - |
| **Coros Vertix 2S** | 294 | ? | - |
| **COROS** | 294 | ? | - |
| **Suunto Race S** | 23 | ? | - |
| **Suunto Vertical** | 23 | ? | - |
| **Suunto** | 23 | ? | - |
| **Amazfit T-Rex 3** | 339 | ? | - |
| **Amazfit Balance 2** | 339 | ? | - |
| **Amazfit Active 3 Premium** | 339 | ? | - |
| **Zepp App** | 339 | ? | - |
| **Huawei Watch GT 6 Pro** | 348 | ? | ❌ Failed |
| **Huawei Watch Fit 5 Pro** | 348 | ? | ❌ Failed |
| **Huawei Watch Fit 4** | 348 | ? | ❌ Failed |
| **Huawei Watch GT 4 Pro** | 348 | ? | ❌ Failed |
| **Huawei Watch Ultimate** | 348 | ? | ❌ Failed |
| **Huawei Health** | 348 | ? | - |
| **Samsung Galaxy Watch Ultra** | 258 | ? | - |
| **Samsung Galaxy Watch 8** | 258 | ? | - |
| **Samsung Galaxy Watch 7** | 258 | ? | - |
| **Samsung Health** | 258 | ? | - |
| **Apple Watch Ultra 3** | 263 | ? | - |
| **Apple Watch Ultra 2** | 263 | ? | - |
| **Apple Watch Series 11** | 263 | ? | - |
| **Apple Watch Series 10** | 263 | ? | - |
| **Apple Sport** | 263 | ? | - |
| **Strava App** | 265 | 265 | - |

## 🔍 Kết quả nghiên cứu & Ánh xạ ID từ Garmin FIT SDK & ANT+

Dựa trên tài liệu chính thống của **Garmin FIT SDK** và **ANT+ Alliance (thisisant.com)**, dưới đây là các phát hiện quan trọng phục vụ cho việc sinh tệp FIT chuẩn hóa trên hệ thống:

### 1. Cơ chế ánh xạ Thiết bị (Device Mapping Rule)
* **Manufacturer ID (Mã nhà sản xuất)**: Được cấp phát độc quyền bởi ANT+ Alliance cho các hãng thành viên. Việc gửi đúng ID này là điều kiện tiên quyết để Strava hiển thị đúng logo thương hiệu và Sync Badge của ứng dụng kết nối tương ứng (ví dụ: `Zepp App` cho Amazfit, `Huawei Health` cho Huawei, `Apple Sport` cho Apple).
* **Product ID (Mã sản phẩm)**:
  * **Đối với Garmin (Manufacturer = 1)**: FIT SDK định nghĩa một danh sách Enum cụ thể (gọi là `garmin_product`). Gửi đúng mã sản phẩm (ví dụ: `4376` cho fēnix 7x Pro, `4315` cho Forerunner 965) sẽ giúp Strava map trực tiếp thiết bị đó từ database.
  * **Đối với các hãng phi-Garmin (Huawei, Coros, Amazfit, Suunto, Apple, Samsung)**: ANT+ không quản lý Product ID của họ trong FIT SDK. 
  * **Bí quyết map thiết bị phi-Garmin**: Khi tạo tệp FIT, nếu thuộc tính `product` được bỏ qua hoặc để `undefined` trong message `file_id` và `device_info`, Strava sẽ tự động kích hoạt cơ chế Fallback: đối chiếu dựa trên thuộc tính **`product_name`** trong message **`device_info`** để hiển thị đúng tên thiết bị trên giao diện. Điều này giúp sửa lỗi thiết bị phi-Garmin bị nhận diện sai hoặc bị ẩn tên.

### 2. Các tham số định danh chuẩn theo tài liệu FIT SDK
Dưới đây là danh sách Manufacturer ID & Product ID chuẩn hóa cho các dòng thiết bị phổ biến đã được tích hợp vào hệ thống:

* **Garmin (Manufacturer: 1)**
  * fēnix 7: `3906` | fēnix 7x Pro: `4376`
  * fēnix 8: `4536` | fēnix 8 Solar: `4533`
  * Forerunner 945: `3113` | Forerunner 935: `2691`
  * Forerunner 955: `4024` | Forerunner 965: `4315`
  * Forerunner 255: `3992` | Forerunner 255S: `3993`
  * Forerunner 265: `4257` | Forerunner 165: `4432`
  * Venu 2: `3703` | Venu 2S: `3704` | Venu 2 Plus: `3851` | Venu Sq 2: `4115`
  * Instinct 2X Solar: `4394` | Epix Pro (Gen 2): `4313`
  * Garmin Connect app: `undefined` (hiển thị nguồn đồng bộ chung của Garmin)
* **COROS (Manufacturer: 294)**
  * Product: `undefined` | Thiết bị: Pace 3, Apex 2 Pro, Vertix 2S (nhận diện qua tên thiết bị)
* **Amazfit / Zepp (Manufacturer: 339)**
  * Product: `undefined` | Thiết bị: T-Rex 3, Balance 2, Active (nhận diện qua tên thiết bị)
* **Huawei (Manufacturer: 348)**
  * Product: `undefined` | Thiết bị: Watch GT 6 Pro, Watch Fit 5 Pro, Watch Fit 3 (nhận diện qua tên thiết bị)
* **Suunto (Manufacturer: 23)**
  * Product: `undefined` | Thiết bị: Race S, Vertical (nhận diện qua tên thiết bị)
* **Samsung (Manufacturer: 258)**
  * Product: `undefined` | Thiết bị: Galaxy Watch Ultra, Galaxy Watch 7/8 (nhận diện qua tên thiết bị)
* **Apple Watch (Manufacturer: 263)**
  * Product: `undefined` | Thiết bị: Apple Watch Series 10/11, Ultra 2/3 (nhận diện qua tên thiết bị)
* **Strava (Manufacturer: 265)**
  * Product: `265` (Dành cho các hoạt động ghi nhận trực tiếp bằng ứng dụng Strava)

### 3. Chuẩn hóa thời gian (Time Standard) trong tệp FIT
* Mọi timestamp trong tệp FIT (`time_created`, `start_time`, `timestamp`) bắt buộc phải theo định dạng **giây kể từ kỷ nguyên FIT epoch** (00:00:00 UTC ngày 31/12/1989).
* Để Strava hiểu đúng múi giờ hiển thị của hoạt động, message `activity` cần ghi nhận thuộc tính `local_timestamp`. Đây là thời gian local tính bằng giây từ FIT epoch (bằng thời gian UTC cộng thêm offset múi giờ). Với múi giờ Việt Nam (GMT+7), công thức `local_timestamp = start_time + 7 * 3600` đang được áp dụng chuẩn xác.
