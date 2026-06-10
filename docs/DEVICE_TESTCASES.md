# Device Verification Testcases - StrAct Z

Use this file to track testing of various devices and applications on Strava. Update their statuses as you perform tests.

## 📋 Device Testcases

| Source Name | Tested Status |
| :--- | :--- |
| **Garmin Forerunner 945** | ✅ OK |
| **Garmin Forerunner 935** | ⏳ Untested |
| **Garmin fēnix 7x Pro** | ✅ OK |
| **Garmin fēnix 8** | ⏳ Untested |
| **Garmin Forerunner 255S** | ⏳ Untested |
| **Garmin Forerunner 255** | ⏳ Untested |
| **Garmin Venu 2** | ⏳ Untested |
| **Amazfit T-Rex 3** | ⏳ Untested |
| **Garmin Connect** | ✅ OK |
| **Zepp App** | ⏳ Untested |
| **Huawei Health** | ✅ OK |
| **Samsung Health** | ⏳ Untested |
| **Apple Sport** | ⏳ Untested |
| **COROS** | ⏳ Untested |
| **Suunto** | ⏳ Untested |
| **Garmin Forerunner 570** | ⏳ Untested |
| **Garmin Forerunner 165** | ❌ Fail |
| **Garmin Instinct 3** | ⏳ Untested |
| **Garmin Instinct 2X Solar** | ⏳ Untested |
| **Garmin Epix Pro (Gen 2)** | ⏳ Untested |
| **Garmin epix Pro (Gen 2) 47mm** | ⏳ Untested |
| **Garmin Venu Sq 2** | ⏳ Untested |
| **Garmin Forerunner 770XT** | ⏳ Untested |
| **COROS APEX 2** | ⏳ Untested |
| **COROS APEX 4** | ⏳ Untested |
| **Coros Pace 3** | ⏳ Untested |
| **Coros Apex 2 Pro** | ⏳ Untested |
| **Coros Vertix 2S** | ⏳ Untested |
| **Suunto Race S** | ⏳ Untested |
| **Suunto Vertical** | ⏳ Untested |
| **Amazfit Balance 2** | ⏳ Untested |
| **Amazfit Active 3 Premium** | ⏳ Untested |
| **Huawei Watch GT 6 Pro** | ⏳ Untested |
| **Huawei Watch Fit 5 Pro** | ⏳ Untested |
| **Huawei Watch GT 4 Pro** | ⏳ Untested |
| **Huawei Watch Fit 3** | ⏳ Untested |
| **Huawei Watch Ultimate** | ⏳ Untested |
| **Samsung Galaxy Watch Ultra** | ⏳ Untested |
| **Samsung Galaxy Watch 8** | ⏳ Untested |
| **Samsung Galaxy Watch 7** | ⏳ Untested |
| **COROS PACE 3** | ⏳ Untested |
| **COROS APEX 2** | ⏳ Untested |
| **Garmin Forerunner 975** | ❌ Fail |
| **Garmin Forerunner 965** | ⏳ Untested |
| **Garmin Forerunner 265** | ❌ Fail |
| **Garmin fēnix 8 Solar** | ❌ Fail |
| **Apple Watch Ultra 3** | ❌ Fail |
| **Apple Watch Ultra 2** | ❌ Fail |
| **Apple Watch Series 11** | ❌ Fail |
| **Apple Watch Series 10** | ❌ Fail |
| **Strava Android App** | ❌ Fail |
| **Strava iPhone App** | ❌ Fail |
| **Strava App** | ✅ OK |

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
