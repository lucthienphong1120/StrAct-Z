Lưu ý: tất cả cập nhật tính năng đều phải note version và update README
+ [x] update tính năng register (multi user)
+ [x] mỗi user seperate quản lý own session để đảm bảo quyền riêng tư và bảo mật (ko có admin user)
+ [x] ko có admin user nhưng có phân biệt vip user và normal (chỉ có thể update từ db)
+ [x] check lại chức năng nút refresh
+ [x] thêm 1 map preview và user edit và config location làm khu vực hoạt động (chấm và vòng tròn cam scale được)
+ [x] khu vực hoạt động sẽ dùng làm tính trọng số random district ưu tiên khu vực gần hơn (cho phép user thêm tối đa 2 vòng tròn khu vực home và work - màu xanh lam)
+ [x] Max Distance default thành 8km
+ [x] phần đầu có thể thêm hoặc thay bằng chart thống kê cho đẹp
+ [x] use osrm thêm ghi chú tác dụng ở dưới
+ [x] update lại toast notification đồng nhất toàn bộ UI dùng chung
+ [x] mọi update config, button sửa đổi, validate, check quyền, vip max range,... đều phải có notify
+ [x] toàn bộ config đều phải có hint (?) button hover hiện giải thích thông tin (ý nghĩa, loại giá trị, đơn vị, phạm vi min/max)
+ [x] review, cân nhắc vị trí có thể dùng Caching layer (optimize API calls)
+ [ ] tích hợp đẩy data về các luồng công cụ Health Hub như Google Fit, Health connect, Samsung Health, Apple Health
+ [ ] tích hợp bổ sung (hint optional, not tested) cho các công cụ luyện tập khác như adidas running, nike run club, runkeeper
+ [ ] review và sửa lại min, max, range các option + validate (min/max/range)
+ [x] update logic random heart rate trọng số theo hoạt động
+ [x] update logic trọng số vị trí
+ [ ] sửa Max heart rate thành input field tự count (hiển thị nhưng readonly), thêm 1 field bên cạnh là tuổi, default 25 tuổi -> MHR tự tính là 195
+ [ ] check lại các công thức trọng số hoạt động đi bộ/đạp xe/chạy bộ - 50-60/60-70/70-85 % MHR
+ [ ] check lại logic nghỉ đèn đỏ -> nghỉ giảm heart rate và thời tiết nắng/mát ảnh hưởng heart rate, trưa/chiều nắng cũng tăng chút
+ [ ] thêm phần account setting vào giao diện sau login và trước khi kết nối strava
+ [ ] đổi tên app trong strava oauth về StrAct Z
+ [ ] tạo và rule file markdown cho AI coding để lưu kiến trúc, ghi nhớ, context cần thiết về project này
+ [ ] các quận default enable thêm long biên
+ [ ] menu account setting thêm phần nhập code để kích hoạt vip (đồng thời bổ sung cơ chế chống gian lận, sniffing, bruteforce, relay,...)
+ [ ] update navigator prev và next chạm biên thì phải làm mờ
+ [ ] restrict linked tài khoản stract z với tối đa 1 tài khoản strava và 1 với mỗi hệ thống tích hợp 3rd (nếu có)
+ [ ] bỏ tính năng xóa với hoạt động uploaded, xóa chỉ áp dụng với generate và chưa upload, với hoạt động đã upload cần vào strava xóa (hint/open strava)
+ [ ] Activity Insights (Cloud) thêm dữ liệu thời gian hoạt động dạng line chart màu xanh dương -> biểu đồ dual metrics kết hợp bar+line
+ [ ] Activity Insights (Cloud) default time select là 7 days
+ [ ] tích hợp thành app addin có thể cài đặt trên chrome (windows/android)
+ [ ] hiển thị sự khác biệt giữa vip và normal account trên UI (nhận diện - nhãn, màu sắc, nổi bật - có thể update cả color/theme giống app ngân hàng)
+ [ ] footer thêm thông tin copyright, email
+ [ ] cuối phần account setting thêm 1 dòng contact for vip: email (chữ xám)
+ [ ] update logic chống trùng lặp với dữ liệu đã có (uploaded/cloud), thêm comfig safe time default 30p -> tránh random data mới quanh thời gian start/end hoạt động đã có
+ [ ] chuyển min/max pace sang phần activity settings (defailt vẫn 8 và 12)
+ [ ] thêm logic trọng số cho random pace theo hoạt động đi bộ/chạy bộ/đạp xe = x1.25/x0.8/x0.5 (update hint luôn)
+ [ ] fix hint z-index cao trên menu, tránh bị overflow, xử lý xuống dòng
+ [ ] thêm nút khóa scale và move cho Activity Areas Map (default yes)
+ [ ] tùy chỉnh mở rộng/thu hẹp vòng tròn vị trí trong Activity Areas Map (kèm thông số ràng buộc min size = hiện tại, max tối đa x2)
+ [ ] file config based các giá trị validate, range cho normal/vip account để tôi tự tùy chỉnh và update (cập nhật readme và kiến trúc luôn)
