# Device Verification Testcases - StrAct Z

Use this file to track testing of various devices and applications on Strava. Update their statuses as you perform tests.

## 📋 Device Testcases

| Source / Device Name | Manufacturer ID | Product ID | Tested Status |
| :--- | :--- | :--- | :--- |
| **Garmin Forerunner 945** | 1 | 3113 | ✅ OK |
| **Garmin Forerunner 935** | 1 | 2697 (fallback) | ⏳ Untested |
| **Garmin fēnix 7x Pro** | 1 | 3907 | ✅ OK |
| **Garmin fēnix 8** | 1 | 4543 | ⏳ Untested |
| **Garmin Forerunner 255S** | 1 | 4024 | ⏳ Untested |
| **Garmin Forerunner 255** | 1 | 4024 (255S ID) | ⏳ Untested |
| **Garmin Venu 2** | 1 | 3703 | ⏳ Untested |
| **Garmin Venu 2S** | 1 | 3704 | ⏳ Untested |
| **Garmin Venu 2 Plus** | 1 | 3851 | ⏳ Untested |
| **Amazfit T-Rex 3** | 292 | 292 | ⏳ Untested |
| **Garmin Connect** | 1 | 3907 (fallback) | ✅ OK |
| **Zepp App** | 292 | 292 (fallback) | ⏳ Untested |
| **Huawei Health** | 201 | 292 (fallback) | ✅ OK |
| **Samsung Health** | 258 | 258 (fallback) | ⏳ Untested |
| **Apple Sport** | 263 | 263 (fallback) | ⏳ Untested |
| **COROS** | 125 | 125 (fallback) | ⏳ Untested |
| **Suunto** | 23 | 23 (fallback) | ⏳ Untested |
| **Garmin Forerunner 570** | 1 | 3907 (fallback) | ⏳ Untested |
| **Garmin Forerunner 165** | 1 | 4533 | ⏳ Untested |
| **Garmin Instinct 3** | 1 | 4600 | ⏳ Untested |
| **Garmin Instinct 2X Solar** | 1 | 4125 | ⏳ Untested |
| **Garmin Epix Pro (Gen 2)** | 1 | 4312 | ⏳ Untested |
| **Garmin epix Pro (Gen 2) 47mm** | 1 | 4312 | ⏳ Untested |
| **Garmin Venu Sq 2** | 1 | 4305 (fallback) | ⏳ Untested |
| **Garmin Forerunner 770XT** | 1 | 3907 (fallback) | ⏳ Untested |
| **Coros Pace 3** | 125 | 125 | ⏳ Untested |
| **Coros Apex 2 Pro** | 125 | 126 | ⏳ Untested |
| **Coros Vertix 2S** | 125 | 127 | ⏳ Untested |
| **Suunto Race S** | 23 | 23 | ⏳ Untested |
| **Suunto Vertical** | 23 | 24 | ⏳ Untested |
| **Amazfit Balance 2** | 292 | 293 | ⏳ Untested |
| **Amazfit Active 3 Premium** | 292 | 294 | ⏳ Untested |
| **Huawei Watch GT 6 Pro** | 201 | 292 | ⏳ Untested |
| **Huawei Watch Fit 5 Pro** | 201 | 293 | ⏳ Untested |
| **Huawei Watch GT 4 Pro** | 201 | 294 | ⏳ Untested |
| **Huawei Watch Fit 3** | 201 | 295 | ⏳ Untested |
| **Huawei Watch Ultimate** | 201 | 296 | ⏳ Untested |
| **Samsung Galaxy Watch Ultra** | 258 | 258 | ⏳ Untested |
| **Samsung Galaxy Watch 8** | 258 | 259 | ⏳ Untested |
| **Samsung Galaxy Watch 7** | 258 | 260 | ⏳ Untested |
| **Garmin Forerunner 975** | 1 | 4543 (fallback) | ⏳ Untested |
| **Garmin Forerunner 965** | 1 | 4314 | ⏳ Untested |
| **Garmin Forerunner 265** | 1 | 4305 | ⏳ Untested |
| **Garmin fēnix 8 Solar** | 1 | 4543 | ⏳ Untested |
| **Apple Watch Ultra 3** | 263 | 263 | ⏳ Untested |
| **Apple Watch Ultra 2** | 263 | 263 | ⏳ Untested |
| **Apple Watch Series 11** | 263 | 263 | ⏳ Untested |
| **Apple Watch Series 10** | 263 | 263 | ⏳ Untested |
| **Strava App** | 255 | 255 | ⏳ Untested |


## 🧪 Hướng dẫn chạy thử và xác minh (Verification Guide)

Nhằm phục vụ việc kiểm thử trên môi trường Production Test, bạn có thể thực hiện theo 2 phương pháp sau:

### Phương pháp 1: Kiểm thử tự động qua Command Line (Server-side)
Dùng để xác nhận thư viện `@markw65/fit-file-writer` hoạt động bình thường trên Server và sinh tệp `.fit` nhị phân hợp lệ cho tất cả các hãng sản xuất (Garmin, Coros, Samsung, Amazfit, Apple, Huawei, Suunto).

1. Truy cập thư mục dự án trên Server qua SSH hoặc terminal.
2. Chạy lệnh kiểm thử:
   ```bash
   node test_fit_gen.js
   ```
3. Quan sát đầu ra. Kết quả mong đợi là:
   - Toàn bộ các bước tạo tệp tin `.fit` cho các thiết bị Garmin, Coros, Samsung, Amazfit, Apple đều trả về trạng thái `Thành công ✅`.
   - Các tệp tin `.fit` mẫu được lưu trong thư mục `data/fit/`.

### Phương pháp 2: Kiểm thử thủ công qua Giao diện (Frontend)
Dùng để kiểm tra trực tiếp tính năng hiển thị Sync Badge và Device Name thực tế trên tài khoản Strava của bạn.

#### Test Case 1: Sinh tệp FIT và tải về máy (Không Upload)
- **Mục đích**: Xác định xem hệ thống có tạo đúng tệp `.fit` cho thiết bị mong muốn hay không.
- **Các bước thực hiện**:
  1. Đăng nhập vào dashboard.
  2. Bật cấu hình **Custom Time (FIT Only)** và chọn một ngày bất kỳ (ví dụ: hôm qua).
  3. Tại card **Activity Settings**, chọn **Loại hoạt động** (ví dụ: `Run`) và **Thiết bị ghi nhận** (ví dụ: `Apple Watch Ultra 2`).
  4. Nhấn nút **📝 Generate FIT Only** ở đầu trang.
  5. Đợi thông báo thành công. Cuộn xuống bảng **Local Generated History**.
  6. Click nút **Download ⬇️** bên cạnh hoạt động vừa sinh.
- **Kết quả mong đợi**:
  - Trình duyệt tải về tệp tin có đuôi `.fit`.
  - Bạn có thể tải tệp tin này lên trang phân tích như [FIT File Viewer](https://www.fitfileviewer.com/) để kiểm tra thông tin Manufacturer và Product ID (đối với Apple Watch, Manufacturer ID là 263).

#### Test Case 2: Tạo hoạt động & Upload trực tiếp lên Strava
- **Mục đích**: Xác thực Strava API nhận diện đúng tệp `.fit`, hiển thị đúng Tên Thiết Bị (Device Name) và huy hiệu đồng bộ (Sync Badge).
- **Các bước thực hiện**:
  1. Đảm bảo tài khoản Strava đã được kết nối (có avatar hiển thị tại card **Strava Account**).
  2. Chọn thiết bị cần kiểm thử tại dropdown **Thiết bị ghi nhận** (ví dụ: `Coros Pace 3` hoặc `Amazfit T-Rex 3`).
  3. Chọn Loại hoạt động và Cự ly mong muốn.
  4. Bật hoặc tắt các giả lập (Nhịp tim, Thời tiết, Đèn đỏ) tùy ý.
  5. Nhấn nút **🚀 Generate & Upload** ở đầu trang.
  6. Chờ hệ thống thực hiện quy trình (Generate -> Upload -> Poll status từ Strava). Khi có thông báo upload thành công, click trực tiếp vào liên kết của hoạt động để mở Strava.
- **Kết quả mong đợi**:
  - Trên ứng dụng hoặc web Strava, hoạt động mới xuất hiện.
  - Phía dưới hoạt động sẽ hiển thị huy hiệu đồng bộ (Sync Badge) tương ứng với ứng dụng gốc (ví dụ: **Zepp App** nếu chọn Amazfit, **COROS** nếu chọn Coros, **Apple Sport** nếu chọn Apple, v.v.).
  - Khi xem chi tiết hoạt động, tên thiết bị ghi nhận (ví dụ: `Amazfit T-Rex 3` hoặc `Coros Pace 3`) được hiển thị chính xác.
  - Lượng Calo tiêu thụ được Strava tự động tính toán (dựa trên thông số nhịp tim, cự ly và thời gian của tệp FIT gửi lên).

#### Test Case 3: Chạy theo lịch tự động (Auto Scheduler)
- **Mục đích**: Xác minh tiến trình cron job tự động kích hoạt sinh tệp `.fit` và tải lên Strava đúng giờ.
- **Các bước thực hiện**:
  1. Bật toggle **Auto Schedule** ở card tương ứng.
  2. Đặt **Mốc thời gian 1** gần với thời gian hiện tại của Server (ví dụ: sau 2-3 phút nữa).
  3. Đặt **Mốc thời gian 2** (nếu có tài khoản VIP) hoặc tắt nó đi.
  4. Đợi đến mốc thời gian đó và kiểm tra nhật ký Server console/logs, hoặc tải lại dashboard sau đó để kiểm tra bảng **Local Generated History**.
- **Kết quả mong đợi**:
  - Khi đến giờ, Server tự động gọi engine sinh lộ trình.
  - Tệp `.fit` được lưu cục bộ và gửi lên Strava.
  - Trạng thái hoạt động trong bảng Local History chuyển sang `UPLOADED` hoặc `FAILED` (kèm lý do rõ ràng nếu vi phạm ràng buộc).
