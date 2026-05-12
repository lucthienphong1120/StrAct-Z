## Prompt:
```
"Hãy đọc file AI_RULES.md trong thư mục gốc để nắm bắt kiến trúc dự án, các quy tắc logic vận hành và các tiêu chuẩn versioning của dự án này. Hãy luôn tuân thủ các quy tắc trong đó khi thực hiện mọi yêu cầu tiếp theo."
Lưu ý: Mỗi khi thay đổi một logic cốt lõi nào đó (ví dụ: thay đổi công thức tính MHR), hãy cập nhật nó vào AI_RULES.md để "bộ nhớ" này luôn luôn mới nhất!
```

## Features:
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
+ [x] tích hợp đẩy data về các luồng công cụ Health Hub như Google Fit, Health connect, Samsung Health, Apple Health
+ [x] tích hợp bổ sung cho các công cụ luyện tập khác như adidas running, nike run club, runkeeper (optional, not tested)
+ [x] review và sửa lại min, max, range các option + validate (min/max/range)
+ [x] update logic random heart rate trọng số theo hoạt động
+ [x] update logic trọng số vị trí
+ [x] sửa Max heart rate thành input field tự count (hiển thị nhưng readonly), thêm 1 field bên cạnh là tuổi, default 25 tuổi -> MHR tự tính là 195
+ [x] check lại các công thức trọng số hoạt động đi bộ/đạp xe/chạy bộ là 50-60/60-70/70-85 % MHR
+ [x] check lại logic nghỉ đèn đỏ -> nghỉ giảm heart rate và thời tiết nắng/mát ảnh hưởng heart rate, trưa/chiều nắng cũng tăng chút
+ [x] menu account setting thêm phần nhập code để kích hoạt vip (đồng thời bổ sung cơ chế chống gian lận, sniffing, bruteforce, relay,...)
+ [x] footer thêm thông tin copyright, email
+ [x] cuối phần account setting thêm 1 dòng contact for vip: email (chữ xám)
+ [x] đổi tên app trong strava oauth về StrAct Z
+ [x] tạo và rule file markdown cho AI coding để lưu kiến trúc, ghi nhớ, context cần thiết về project này
+ [x] các quận default enable thêm long biên
+ [x] update navigator prev và next chạm biên thì phải làm mờ
+ [x] bỏ tính năng xóa với hoạt động uploaded, xóa chỉ áp dụng với generate và chưa upload, với hoạt động đã upload cần vào strava xóa (có thể thêm hint hoặc thay bằng nút open in strava)
+ [x] Activity Insights (Cloud) thêm dữ liệu thời gian hoạt động dạng line chart màu xanh dương -> biểu đồ dual metrics kết hợp bar+line
+ [x] Activity Insights (Cloud) default time select là 7 days
+ [x] tích hợp thành PWA/Addin có thể cài đặt trên chrome (windows/android)
+ [x] hiển thị sự khác biệt giữa vip và normal account trên UI (nhận diện - nhãn, màu sắc, nổi bật - có thể update cả color/theme giống app ngân hàng) -> lưu ý chỉ đổi màu và interface cơ bản, không thay layout, không thay đổi logic vận hành
+ [x] update logic chống trùng lặp với dữ liệu đã có (uploaded/cloud), thêm comfig safe time default 30p -> tránh random data mới quanh thời gian start/end hoạt động đã có
+ [x] chuyển min/max pace sang phần activity settings (defailt vẫn 8 và 12)
+ [x] khi disable Heart Rate Data thì phần nhập User Age và Max Heart Rate (MHR) sẽ bị làm mờ (disable)
+ [x] thêm logic trọng số cho random pace theo hoạt động đi bộ/chạy bộ/đạp xe = x1.25/x0.8/x0.5 (update hint luôn)
+ [x] fix hint z-index cao trên menu, tránh bị overflow, xử lý xuống dòng
+ [x] thêm nút khóa scale và move cho Activity Areas Map (default yes)
+ [x] tùy chỉnh mở rộng/thu hẹp vòng tròn vị trí trong Activity Areas Map (kèm thông số ràng buộc min size = hiện tại, max tối đa x2)
+ [x] file config based các giá trị gồm default validate, range, type cho normal/vip account để tôi tự tùy chỉnh và update (cập nhật readme và kiến trúc luôn, hướng dẫn cách manual update)
+ [x] hint ngoài thông tin về config sẽ xuống dòng và thêm thông tin dynamic từ config file (validate, range, type)
+ [x] tính năng switch to normal theme và switch back để preview sự khác biệt của theme (chỉ vip user mới có) -> đảm bảo bảo mật, chống lạm dụng và gian lận dựa trên tính năng này
+ [x] chỉnh lại giảm trọng số của home và work location
+ [x] fix lại chức năng nút save chưa hoạt động, phải hiện toast
+ [x] đồng nhất định dạng hint cho phần thông báo xóa activity trên strava
+ [x] thêm highlight biên giới các quận viền đỏ đậm hơn trong Activity Areas Map (với danh sách các quận nội thành HN đã list - highlight polygon thực tế)
+ [x] tải source GeoJSON về project và update AI_RULES.md, README.md, kiến trúc
+ [x] fix lỗi 404 khi tải GeoJSON bằng cách thêm explicit route trong server.js
+ [x] nâng cấp theme bản đồ sang CartoDB Dark Matter và đổi màu biên giới (Gold cho VIP, Cyan cho Normal)
+ [x] cập nhật biên giới các quận trong Activity Areas Map khi hover chuột qua sẽ hiện tên quận đó
+ [x] cập nhật hint của Activity Areas (Map) về tỷ lệ random và xuống dòng
+ [x] review lại file config limit, loại bỏ tham số cũ ko sử dụng, update tham số dùng chung, tỉ lệ giá trị chuẩn
+ [x] activity map khi save lưu cả vị trí zoom và scale hiện tại
+ [x] thêm nút reset to default cạnh nút refresh -> cập nhật tất cả value về mặc định (theo file config), riêng map không xóa point mà chỉ reset tọa độ và scale về mặc định
+ [x] khi nhấn refresh sẽ load lại data cloud, bỏ qua cache, map bà các tab load lại data từ save
+ [x] check lại HANOI_DISTRICTS trong route_engine đã đúng chuẩn dữ liệu thật chưa (lon,lat,...) theo geojson data
+ [x] tách nhỏ các file theo chức năng (js, css, ...) để phục vụ AI analysis dễ dàng hơn
+ [x] xử lý validate khi input áp dụng toàn bộ config trong file base config limit (type, min, max, range, ...) -> toast thông báo khi nhập sai/ngoài phạm vi cho phép, tối ưu về mặt giao diện và logic xử lý khi nhập sai
+ [x] check lại logic Auto Schedule min/max đang đặt từ 1-2 hoạt động/ngày nhưng sao thấy toàn random ra 2
+ [x] update lại hint của Heart Rate Zones (Target) và các giá trị thành chữ thường, tạo readonly config tương ứng để show về tỉ lệ hệ số distance và pace từ Activity Type -> đồng thời move min/max Distance (km) xuống gần
+ [x] test và debug lỗi tích hợp google fit (console log), thông báo khi connect/disconnect,...
+ [x] cấu hình fallback của theme mặc định các icon, tone màu xám, thay vì default màu cam của normal (tránh flash màu cam cho VIP user)
+ [x] update cho tôi logo với theme của fall back màu xám hoặc normal cũng gadient giống như vip, màu xám sẫm tối hơn (v1.50.32)
+ [x] theme của normal phần chữ title không dùng gadient, giá trị 4 card dùng màu cam, không đen, nút generate & upload và các nút save để như cũ (v1.50.33)
+ [x] fix lỗi logo VIP theme bị mất icon và sai màu chữ (v1.50.34)
+ [ ] update config Time Range trong custom time (gfx only) default thành 00:00 (tức random time), nếu user đặt vào 00:00 cũng sẽ hiểu là random time trong ngày, chỉ cần Target Date là được
+ [x] check fix lại logic safe time, thời gian random ra sát nhau -> cái này chỉ thêm 1 thời gian để tránh không random ra, logic giống với Avoid Workhours, không thay đổi logic tạo sinh
+ [x] sử dụng cache layer cho số liệu từ Google Fit sync, bỏ nút refresh cạnh đó mà sử dụng chung nút refresh ở trên, tất cả dữ liệu sẽ load lại khi user nhấn nút refresh hoặc reset hoặc Ctrl+Shift+R hoặc F5, hoặc khi truy cập trang dashboard lần đầu (áp dụng tương tự cho data lấy về từ strava cloud và cả 2 tab: History và Insights)
+ [x] bỏ nút logout system khỏi menu Strava Account (đã có nút logout ở header cạnh tên user rồi), đổi format nút disconnect strava giống nút disconnect google fit
+ [x] fix lỗi Min Count của schedule khi đặt thành 0 nhưng reload lại trang lại bị về 1
+ [x] cập nhật AI Rule không cần update version ở dòng 1 file readme, chỉ cần bổ sung changelog nếu thay đổi tính năng lớn, file readme chủ yếu mô tả tính năng và hướng dẫn setup, hướng dẫn sử dụng
+ [x] cập nhật Local Generated History bổ sung time filter tương tự Strava Cloud Activities, check chéo mapping những uploaded activities (4 trạng thái duy nhất) -> để lưu trữ log
+ [ ] check lý do bất đồng bộ dữ liệu hoạt động giữa Local Generated History và Strava Cloud Activities
+ [x] cập nhật hint của Activity Areas Map, thêm phần trọng số format giống Distance Multipliers, Heart Rate Zones, show thêm config về limit số lượng home, work (vip: 2, normal: 1), và scale radius (vip: 4000, normal: 3000) - giống Daily Upload Limit
+ [ ] cấu hình cho phép schedule 2 khung giờ -> tùy chọn 1 khung giờ hoặc 2 khung giờ
+ [ ] sửa logic bao phủ của khu vực hoạt động thay vì Fully	Mostly	Partially chưa hợp lý vì mỗi quận sẽ có độ rộng khác nhau, và 1 vòng tròn có thể to bao phủ cả 1 quận hoặc 1 quận cũng có thể to bao phủ 1 vòng tròn -> tìm giải pháp hợp lý, có thể theo tỉ lệ diện tích, nhưng tôi vẫn muốn tỉ lệ các quận công bằng và hợp lý (không quan tâm quận to hay quận nhỏ), chia theo 3 vùng trọng số như hiện tại
+ [ ] fix lỗi lưu, you can select up to 0 type of activity
+ [ ] responsive cho mobile
+ [ ] check logic luồng đồng bộ sang fit như nào (realtime hoặc upload previous được giống strava)
+ [x] hướng dẫn tôi cách bỏ vip của 1 tài khoản (tôi đang test, tôi sẽ ko xóa vội đâu) - đã update vào README.md (v1.50.35)
