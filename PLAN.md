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
+ [ ] tích hợp thêm các luồng công cụ khác như Fit, Health connect,...
+ [ ] review và sửa lại min, max, range các option + validate (min/max/range)
+ [x] update logic random heart rate trọng số theo hoạt động
+ [x] update logic trọng số vị trí
+ [ ] sửa Max heart rate thành input field tự count, thêm 1 field bên cạnh là tuổi default 25 tuổi -> MHR là 195
+ [ ] check lại các công thức trọng số hoạt động đi bộ/đạp xe/chạy bộ - 50-60/60-70/70-85 % MHR
+ [ ] check lại logic nghỉ đèn đỏ -> nghỉ giảm heart rate và thời tiết nắng/mát ảnh hưởng heart rate, trưa/chiều nắng cũng tăng chút
+ [ ] thêm phần account setting vào giao diện sau login và trước khi kết nối strava
+ [ ] đổi tên app trong strava oauth về StrAct Z
+ [ ] tạo và rule file markdown cho AI coding để lưu kiến trúc, ghi nhớ, context cần thiết về project này
+ [ ] các quận default enable thêm long biên
+ [ ] 
