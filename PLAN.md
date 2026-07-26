## Prompt:
```
"Hãy luôn đọc file AI_RULES.md trong thư mục gốc để nắm bắt kiến trúc dự án, các quy tắc logic vận hành, các tiêu chuẩn versioning của dự án, và file PLAN.md để nắm bắt tiến độ thực hiện các tính năng. Luôn tuân thủ các quy tắc trong đó khi bắt đầu phiên làm việc (session) mới và tiếp tục thực hiện các nhiệm vụ tiếp theo.
Lưu ý về vai trò các tài liệu:
- README.md: Dành cho người dùng/dev/client xem tổng quan, cách cài đặt và sử dụng cơ bản.
- docs/ARCHITECTURE.md: Chỉ chứa diagram và flowchart kiến trúc hệ thống dạng Mermaid (không chứa text tài liệu).
- docs/HANOI_POIS.md: Danh sách địa danh danh lam thắng cảnh Hà Nội.
- AI_RULES.md: Chứa toàn bộ logic kỹ thuật chi tiết, công thức, tham số cấu hình, quy định phát triển và toàn bộ lịch sử thay đổi (detailed changelog) làm bộ nhớ cho AI assistant làm việc."
Lưu ý: Mỗi khi thay đổi một logic cốt lõi nào đó (ví dụ: thay đổi công thức tính MHR), hãy cập nhật nó vào AI_RULES.md để "bộ nhớ" này luôn luôn mới nhất! Khi hoàn thành mỗi task nhớ commit và push lên git, đồng thời update các docs cần thiết và đánh version để track. Ngoài ra còn có danh sách địa danh tại docs/HANOI_POIS.md, cập nhật nếu thay đổi liên quan đến danh sách địa danh.
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
+ [x] fix lỗi Strava không nhận diện đúng source device cho Zepp/Amazfit (tối ưu cấu trúc file GPX/FIT format và external_id)
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
+ [x] update config Time Range trong custom time (gfx only) default thành 00:00 (tức random time), nếu user đặt vào 00:00 cũng sẽ hiểu là random time trong ngày, chỉ cần Target Date là được
+ [x] check fix lại logic safe time, thời gian random ra sát nhau -> cái này chỉ thêm 1 thời gian để tránh không random ra, logic giống với Avoid Workhours, không thay đổi logic tạo sinh
+ [x] sử dụng cache layer cho số liệu từ Google Fit sync, bỏ nút refresh cạnh đó mà sử dụng chung nút refresh ở trên, tất cả dữ liệu sẽ load lại khi user nhấn nút refresh hoặc reset hoặc Ctrl+Shift+R hoặc F5, hoặc khi truy cập trang dashboard lần đầu (áp dụng tương tự cho data lấy về từ strava cloud và cả 2 tab: History và Insights)
+ [x] bỏ nút logout system khỏi menu Strava Account (đã có nút logout ở header cạnh tên user rồi), đổi format nút disconnect strava giống nút disconnect google fit
+ [x] fix lỗi Min Count của schedule khi đặt thành 0 nhưng reload lại trang lại bị về 1
+ [x] cập nhật AI Rule không cần update version ở dòng 1 file readme, chỉ cần bổ sung changelog nếu thay đổi tính năng lớn, file readme chủ yếu mô tả tính năng và hướng dẫn setup, hướng dẫn sử dụng
+ [x] cập nhật Local Generated History bổ sung time filter tương tự Strava Cloud Activities, check chéo mapping những uploaded activities (4 trạng thái duy nhất) -> để lưu trữ log
+ [x] check lý do bất đồng bộ dữ liệu hoạt động giữa Local Generated History và Strava Cloud Activities
+ [x] cập nhật hint của Activity Areas Map, thêm phần trọng số format giống Distance Multipliers, Heart Rate Zones, show thêm config về limit số lượng home, work (vip: 2, normal: 1), và scale radius (vip: 4000, normal: 3000) - giống Daily Upload Limit
+ [x] cấu hình cho phép schedule 2 khung giờ -> tùy chọn 1 khung giờ hoặc 2 khung giờ (v1.51.17)
+ [x] sửa logic bao phủ của khu vực hoạt động thay vì Fully	Mostly	Partially chưa hợp lý vì mỗi quận sẽ có độ rộng khác nhau, và 1 vòng tròn có thể to bao phủ cả 1 quận hoặc 1 quận cũng có thể to bao phủ 1 vòng tròn -> tìm giải pháp hợp lý, có thể theo tỉ lệ diện tích, nhưng tôi vẫn muốn tỉ lệ các quận công bằng và hợp lý (không quan tâm quận to hay quận nhỏ), chia theo 3 vùng trọng số như hiện tại (v1.51.23)
+ [x] fix lỗi lưu, you can select up to 0 type of activity (v1.50.38)
+ [x] responsive cho mobile (v1.51.15)
+ [x] check logic luồng đồng bộ sang fit như nào (realtime hoặc upload previous được giống strava)
+ [x] hướng dẫn cách bỏ vip của 1 tài khoản
+ [x] fix lỗi ReferenceError: center is not defined khi tạo khu vực Home/Work trên bản đồ (v1.50.37)
+ [x] Activity Areas sửa lại tối đa điểm nhà là 1 không phải 2, tối đa điểm công ty là 2 với vip và 1 với normal account
+ [x] Auto-lock map khi save Activity Areas (v1.51.7)
+ [x] Tách Random Time Bounds ra ngoài config chung, không bị ẩn khi toggle Custom Time (v1.51.8)
+ [x] Sửa Target Time thành input 1 giờ duy nhất cho GPX Only (v1.51.9)
+ [x] Cập nhật logic Avoid Workhours chỉ hoạt động T2-T6 (v1.51.8)
+ [x] Refine UI Time Configuration: bỏ khung viền, update input size (v1.51.9)
+ [x] Cập nhật Avoid Workhours full dòng, chia đôi 50/50 (v1.51.10)
+ [x] Enforce định dạng giờ 24h toàn hệ thống (v1.51.10)
+ [x] Khôi phục format Map Info "count/max" và màu sắc (v1.51.11)
+ [x] Sửa lỗi lưu vị trí/zoom bản đồ và auto-lock khi Save (v1.51.11)
+ [x] Check logic random/schedule đảm bảo nằm trong Bounds và không trùng Workhours/Existing (v1.51.9)
+ [x] phần Time Configuration và Daily Run Time sửa về dùng định dạng 24:00 (v1.51.12)
+ [x] Fix lỗi vỡ layout index.html và lỗi JS loadConfig (v1.51.14)
+ [x] thêm thông tin cách event được tạo cho event trong Local Generated History là 1 label format giống và ở cạnh label quận (giá trị: Manual / Schedule 1/Schedule 2) (v1.51.21)
+ [x] fix lỗi responsive mobile (debug và test bằng browser)
+ [x] check avoid workhours exception, nếu người dùng tùy chỉnh avoid hour và các event vô tình chặn hết khả năng để tạo 1 event mới thì phải có thông báo không thể tạo, chứ không phải treo hoặc cố đấm ăn xôi (max retries mỗi khi tạo event mà trùng giờ hoặc không hợp lý là 10 lần), với các event fail thì sẽ có label ở history là FAILED (bổ sung trạng thái thứ 5 ngoài 4 trạng thái đã có)
+ [x] thêm option tùy chọn (default enable) và cập nhật logic để tăng trọng số +0.5 cho các quận xung quanh event gần nhất (uploaded - nếu đã removed thì lấy event gần nhất uploaded - tính theo cache), mapping data các quận cạnh nhau
+ [x] cập nhật lại giảm trọng số khu vực nhà/công ty về 0.x (giảm 2-3 lần)
+ [x] check lại lỗi shedule 1,2 ở generated history -> schedule 1 là trước (sớm hơn schedule 2)
+ [x] check lại lỗi event schedule count: đặt 0-2 acts x 2 schedule nhưng schedule 1 là 0-2, còn schdule 2 luôn spam 3 event mỗi ngày lận
+ [x] làm tính năng check version của client trong trình duyệt/addon, khi khác phiên bản mới nhất thì hiện popup và có nút update để Ctrl+Shift+R (dùng giải cache cho phone và web)
+ [x] giảm màu/hiệu ứng khi hover dòng (line hover) của Strava Cloud Activities và Local Generated History
+ [x] phần Activity Insights (Cloud) tôi muốn hiển thị thêm thông tin thứ 3: số lượng event trong ngày, tổng quãng đường và tổng thời gian (có thể cho cột dọc số lượng event dạng bar, 2 cái kia dạng line chart hoặc thiết kế idea nào phù hợp) -> các thông tin này lấy từ cache của Strava Cloud Activities
+ [x] 4 tab ở trên cũng phải check và update lại logic chuẩn theo Local Generated History toàn thời gian: Total Activities (tổng event tất cả status, Uploaded các event đang ở trạng thái uploaded -> update theo cache, Total Distance và Total Duration tính theo giá trị của tổng event uploaded và generated)
+ [x] check lại hint đang lỗi không hiển thị đúng: Heart Rate Zones, Max Heart Rate, Avoid Workhours, Random Time Bounds, Auto Schedule, Local Generated History, Strava Cloud Activities
+ [x] chuyển hint cạnh title Activity Areas (Map) xuống cạnh chữ Trọng số tác dụng
+ [x] chuyển hint cạnh Auto Schedule xuống cạnh chữ Mốc thời gian 1 (24h)
+ [x] check thêm cấu trúc dữ liệu của api hoạt động từ strava cloud activities xem có mã định danh thiết bị/nguồn dữ liệu nhập không
+ [x] tách các cấu hình thời gian ra 1 thẻ riêng (Time configuration), thêm option thời gian nghỉ sau hoạt động (rest time) default = 50% thời lượng hoạt động trước đó -> dạng readonly, cộng thêm với Safe Time (v1.51.36)
+ [x] check và confirm lại logic Safe Time, khi event được tạo sẽ kiểm tra các event trong ngày, thời gian random phải khác với endtime (tự tính hoặc lấy từ hoạt động đã upload) của các event đã tạo + safe time + resttime, đồng thời không được vào avoid workhours (v1.51.36)
+ [x] cập nhật các mã thiết bị thể thao mới cho năm 2025-2026, set Garmin Forerunner 975 làm mặc định và nâng phiên bản lên v1.51.37
+ [x] kiểm tra, tối ưu hóa logic đánh giá trạng thái các nút toggle (OSRM, Weather, RedLights, HeartRate, BoostAdjacent) tránh bỏ sót khi bị disable và nâng phiên bản lên v1.51.38
+ [x] kiểm tra token backend mỗi request để đảm bảo tránh lỗ hổng BAC
+ [x] update docs và tài liệu, prompt mới để update kiến thức
+ [x] check endpoint /api/version mỗi khi up ver
+ [x] kiểm tra validate theo backend để tránh normal account sủa request vi phạm (type, range)
+ [x] check token khi client request change để đảm bảo range/config hợp lệ nếu là vip
+ [x] check lại công thức xác suất và trọng số gen vị trí ngẫu nhiên, toàn bộ event 2 tuần gần đây đều là hoàn kiếm
+ [x] sau 1 thời gian app bị logout thì các chức năng đặt lịch và upload có còn hoạt động không
+ [x] tối ưu log debug tỉ lệ quận (console.table, lọc bỏ quận 0%) và sửa layout responsive map card (v1.51.49)
+ [x] tối ưu hóa độ chân thực GPX (độ cao tích lũy 1-5m, schema gpxtpx), metadata upload (sport type, description chỉ ghi tên thiết bị, creator là tên App nguồn của thiết bị để có tag đồng bộ tương ứng ở dưới), sửa vỡ responsive Avoid Workhours, điều chỉnh trọng số quận, cập nhật danh sách Device Name hỗ trợ Coros, và sửa lỗi cơ chế chống trùng lặp thời gian random (v1.51.52)
+ [x] responsive thông báo cập nhật phiên bản và username, logo vip ở header trên mobile (v1.51.52)
+ [x] đồng nhất khoảng cách giữa các nút config trên dưới (ví dụ avoid workhour và global random time đang bị sát nhau) (v1.51.52)
+ [x] check lại khi map lock vẫn resize vòng tròn work/home và sửa config map được, khiến khi lưu bị thay đổi dù map vẫn lock (v1.51.52)
+ [x] sửa hiển thị thông báo lỗi khi chạm giới hạn upload, bỏ khóa giới hạn khi chỉ tạo GPX (Generate GPX Only), áp dụng khóa giới hạn vào Scheduler và Manual Upload, và sửa lỗi cache desync sau khi xóa hoạt động trên cloud (v1.51.53)
+ [x] cấu trúc lại kiểm tra giới hạn upload của Generate & Upload và Auto Scheduler để lưu hoạt động dưới trạng thái FAILED kèm lý do thay vì dừng sớm (v1.51.54)
+ [x] thêm device của amazfit, bỏ 1 cái coros, bỏ xiaomi (v1.51.55)
+ [x] cập nhật hệ số trọng số quận theo hành vi thực tế trên Strava (Home +4.5/Mostly +3.2/Partially +1.8, Work +2.5/+1.2/+0.8, Adjacent Boost +1.2) (v1.51.56)
+ [x] Sửa 19 lỗi hệ thống theo báo cáo code review và nâng version lên v1.52.0 (v1.52.0)
+ [x] Sửa lỗi thiếu biến lastUploaded, responsive popup và dọn dẹp migration cũ lên v1.52.1 (v1.52.1)
+ [x] tách insight chart các ô vuông màu cam cho event được tạo từ stract-z, ô màu tím là event từ cloud (v1.52.2)
+ [x] limit max event áp dụng cho tất cả event từ cloud, kể cả có tạo từ stract-z hay không (vd 1 ngày đã hoạt động thực đủ 5 event rồi thì schedule tạo ra event FAILED) (v1.52.2)
+ [x] đổi màu thông báo 22:00 & 14:00 với normal account (v1.52.2)
+ [x] bỏ line thời gian trong activity insights để tránh quá nhiều thông tin (v1.52.2)
+ [x] đổi line distance thành màu vàng (v1.52.2)
+ [x] điều chỉnh hệ số khoảng cách và pace của đi bộ và đạp xe cho thực tế hơn (v1.52.2)
+ [x] điều chỉnh bộ chọn activity type kèm trọng số ngẫu nhiên mới (Random misc/rush, Run, Walk, Ride) (v1.52.6)
+ [x] cập nhật mô tả chi tiết của từng loại hoạt động dưới bộ chọn dropdown, tự động hiển thị mô tả khi tải trang và khi reset (v1.52.7)
+ [x] sắp xếp lại thứ tự và chú thích nhóm thực tế của các cấu hình trong limits.js theo hiển thị trên UI (v1.52.8)
+ [x] cập nhật tên các card trên UI khớp với tên nhóm cấu hình trong limits.js và lược bỏ chú thích thừa (v1.52.9)
+ [x] điều chỉnh Boost Adjacent bao gồm cả quận của hoạt động gần nhất và tăng trọng số lên +1.5 (v1.53.0)
+ [x] điều chỉnh trọng số các mức bao phủ Home (+4.5/+3.2/+1.5) và Work (+2.8/+1.5/+0.8) (v1.53.1)
+ [x] quy hoạch toàn bộ hằng số trọng số và hệ số nhân thuật toán về limits.js làm nguồn chân lý duy nhất (Source of Truth) và cập nhật động toàn bộ UI/Frontend (v1.54.0)
+ [x] check lại schedule nếu nhiều hoạt động sẽ gen từng cái 1 và có delay, kiểm tra overlap time, nếu ko phù hợp vẫn có thể 1 uploaded 1 failed (v1.55.0)
+ [x] check tỉ lệ dừng đèn đỏ 1.5% mỗi point di chuyển hay như nào (v1.55.0)
+ [x] tăng tỉ lệ trọng số của home (+7/+5.2/+2.8) và work (+5.5/+3.2/+1.5) (v1.55.0)
+ [x] tăng tỉ lệ boot adjacent thành +1.8 cho các quận kế bên và thêm x1.5 (+2.7) cho chính quận của hoạt động gần nhất (v1.55.0)
+ [x] check lại tính năng mở rộng phạm vi max 2 quận -> tăng phạm vi random thôi chứ không bắt buộc là luôn đi qua 2 quận (v1.55.0)
+ [x] làm tính năng toggle target distance ở dưới phần Auto schedule (default off làm mờ, khi on sẽ cho phép cấu hình target distance (5-30km)) -> nếu bật thì khi random hoạt động cuối ngày (VD: schedule 2) sẽ check và cố gắng để đạt phần distance còn lại trong ngày (VD: 10km) để đạt target distance (không được vượt quá random max distance) (copy/random cộng trừ 50-200m) (v1.57.0)
+ [x] địa điểm chạy random ưu tiên các khu vực có traffic thấp, hoặc gần hồ, công viên, các địa điểm nổi tiếng hoặc các khu vực có nhiều hoạt động (v1.56.0)
+ [x] Device Name cho nhập Free text (với vip account) -> validate auth để normal account không lạm dụng tính năng hay vượt quyền bảo mật (v1.56.0)
+ [x] chuyển toast notify lên trên bên phải thay vì ở dưới góc dưới bên phải màn hình (v1.58.0)
+ [x] làm lại UI nhận diện chữ VIP cạnh tên user và cả mobile (v1.58.0)
+ [x] mobile responsive fit layout overflow để không bị tràn ngoài màn hình, hiện đang bị với thông báo nâng ver, thông báo sự kiện tít dưới màn hình,... (v1.58.0)
+ [x] chuyển thông báo nâng ver fit với màn hình thay vì thông báo ngang góc dưới, đặt ngay giữa màn hình và hình chữ nhật ngắn (v1.58.0)
+ [x] troubleshoot nguyên nhân đặt count 1-1 và 2 schedule nhưng vẫn tạo ra 1 hoạt động/ngày và luôn là 8km (max distance theo Target Distance) (v1.58.2)
+ [x] thêm log khoảng cách đã chạy trong ngày và loại trừ target distance cho hoạt động sinh thủ công (v1.58.3)
+ [x] thêm log khoảng cách đã chạy trong ngày hiển thị ở console trình duyệt (v1.58.4)
+ [x] bỏ log đếm khoảng cách tích lũy trong ngày ở backend scheduler (v1.58.5)
+ [x] sửa lỗi log tổng khoảng cách chạy trong ngày bị hiển thị 2 lần khi tải trang (v1.58.6)
+ [x] fix lại activity khi đẩy sang strava lại bị thiếu Source (tôi dùng Amazfit Active 3 Premium -> đang bị thiếu phần source, chỉ có phần mô tả so với Huawei Fit 5 Pro trước đó) (v1.59.0)
+ [x] đổi swap vị trí desc (mô tả) và device name (nguồn) trong file gpx để khi hiện thị phần mô tả sẽ là (VD: Huawei Health/Zepp App/Garmin Connect/Apple Sport...) và device name sẽ là (VD: Amazfit Active 3 Premium/Huawei GT 4 Pro/...) để khi đẩy sang strava nó hiển thị đúng tên thiết bị (v1.59.0)
+ [x] troubleshoot và fix Lỗi Service Worker với phương thức POST (TypeError: Failed to execute 'put' on 'Cache': Request method 'POST' is unsupported)
+ [x] tăng độ biến động và gợn sóng nhỏ của nhịp độ (pace) bằng cách resample điểm lộ trình 10m đồng đều và bo tròn giây nguyên (v1.60.0)
+ [x] revert swap gpx creator/description, cập nhật map Amazfit thành 'Amazfit' để hiển thị lại source badge (v1.60.1)
+ [x] fix lỗi overlap checks bằng cách loại bỏ các hoạt động FAILED, DELETED và REMOVED ra khỏi danh sách chặn (v1.60.2)
+ [x] đồng bộ tự động trạng thái REMOVED của hoạt động từ Strava Cloud về database local để không bị khóa lầm khung giờ (v1.60.3)
+ [x] tối ưu hóa cache layer tập trung (50 hoạt động gần nhất, cache 30 phút), tự động đồng bộ DB local khi lấy hoạt động từ Strava và clear cache khi reset/refresh/upload/generate-and-upload/delete (v1.60.4)
+ [x] swap lại GPX creator (tên thiết bị) và Strava description (tên app kết nối), đổi tên app thiết bị Amazfit thành 'Zepp App' thay vì 'Amazfit' (v1.60.4)
+ [x] thêm docs về allow device và test để ra danh sách device chuẩn, bao gồm thêm cả app connect cũng được tính, bỏ phần mô tả cũng được (v1.60.5)
+ [x] cập nhật danh sách thiết bị cho phép trong config/limits và index.html; hỗ trợ hiển thị sao ★ trên UI trong khi lưu giá trị sạch ở backend; cấu hình upload description trống toàn cục (v1.60.5)
+ [x] sửa lỗi scheduler tự động lập lịch cho mốc thời gian 2 ngay cả khi người dùng đã tắt Auto Schedule (v1.60.6)
+ [x] swap vị trí thẻ Google Fit Account và Strava Account, thêm trường Daily Max Activity (editable, int, min = 1, max = daily upload limit) ở dưới Daily Upload Limit, cho phép user điều chỉnh giới hạn hoạt động upload mỗi ngày (giống Daily Upload Limit nhưng được custom, còn Daily Upload Limit là theo cấp độ VIP/Normal tài khoản - readonly) (v1.60.7)
+ [x] khi login, logout cũng phải clear cache browser (Ctrl+Shift+R), giống với lúc version mismatch (v1.60.7)
+ [x] debug frontend restrict normal account (v1.60.7)
+ [x] debug và test các lỗi frontend giữa normal/vip account
+ [x] Chuyển đổi toàn bộ cơ chế tạo lộ trình từ GPX sang định dạng nhị phân chuẩn .fit (Garmin FIT) để hiển thị Sync Badge và tự động tính Calo trên Strava (v2.0.0)
+ [x] Cấu hình chuẩn hóa Manufacturer ID số nguyên cho các dòng thiết bị (Garmin, Coros, Amazfit, Apple, Samsung, Huawei, Suunto) để sửa lỗi hiển thị trên Strava (v2.0.0)
+ [x] Tự động hóa quá trình di chuyển cơ sở dữ liệu (migration gpx_file -> fit_file) và thư mục lưu trữ (data/gpx -> data/fit) để tránh lỗi trên Production (v2.0.0)
+ [x] Bổ sung tài liệu hướng dẫn kiểm thử các test case chi tiết cho người dùng và cập nhật tài liệu hướng dẫn sử dụng (v2.0.0)
+ [x] Đổi tên file FIT và external_id sang UUID ngẫu nhiên (dạng `uuid-activity.fit`) để giống với các hoạt động thật (v2.0.0)
+ [x] Dọn dẹp triệt để các cấu hình cũ không sử dụng liên quan đến GPX (như cron job dọn dẹp GPX hàng tuần) và sửa lỗi Version Mismatch trên UI (v2.0.1)
+ [x] Sửa lỗi ánh xạ Garmin Venu 2 bị nhận nhầm trên Strava (đưa về đúng Product ID 3703/3704/3851 cho dòng Venu 2/2S/2 Plus), bổ sung Strava App và các mẫu đồng hồ mới vào Preset, điều chỉnh trọng số vùng Nhà/Công ty theo yêu cầu của user và đưa danh sách thiết bị lỗi về Untested để test lại trên Production (v2.0.2)
+ [x] sửa các console log debug hiện tại chỉ chạy 1 lần mỗi khi tải trang hoặc ấn nút refresh, không cần lặp lại mỗi khi sinh hoạt động mới, trừ error, warning, lỗi,... (v2.0.2)
+ [x] Sửa lỗi tham chiếu userRefresh, cập nhật CACHE_NAME trong Service Worker và sửa cơ chế chồng chéo thời gian đối với hoạt động nháp (generated) ở chế độ thủ công (v2.0.2)
+ [x] kiểm tra logic gen hoạt động hiện tại có tính chia chi tiết đơn vị nhỏ nhất là gì, có đang theo phường/xã trong quận ko? xử lý tăng độ ưu tiên xuất phát điểm gần tâm vòng tròn work/home (v2.0.3)
+ [x] kiểm tra các luồng tự động vẫn hoạt động tốt với multi-account (schedule, linked tài khoản, generate and upload, history,...) không bị nhầm hoặc xung đột giữa các tài khoản user khác hoặc các phiên cũ trên browser (v2.0.3)
+ [x] thêm cấu hình toggle Prioritize Centers (default true), nếu bật và nếu hoạt động được sinh tại chính quận chứa tâm vòng tròn Home/Work thì có 60% tỉ lệ điểm xuất phát bắt đầu quanh tâm vòng tròn (+ random từ 200m - 500m) (v2.0.4)
+ [x] về tính năng "Fallback tự nhiên: Nếu quận được chọn không chứa tâm vòng tròn, roll trượt (rơi vào 40% còn lại), hoặc tính năng này bị tắt đi, lộ trình sẽ sinh ngẫu nhiên quanh các POI hoặc tâm quận như bình thường." -> đổi tên thành Start Near Favorite Place
+ [x] tính năng Start Near Favorite Place: 55% là start tại tâm home/work, 35% là start tại POI nổi tiếng/khu tập luyện/cảnh đẹp/ao hồ/công viên, 5% còn lại là ngẫu nhiên, bỏ option tâm quận đi -> ko ai tự nhiên lại chạy ở tâm quận cả (đồng thời update lại phần tooltip chú thích)
+ [x] thuật toán Ray-Casting: Tôi đã viết thêm một bộ kiểm tra điểm-trong-đa-giác (Point-in-Polygon) thuần túy dạng Ray-Casting sử dụng dữ liệu ranh giới thật, thay vì vòng tròn ước lượng -> đồng ý, nhưng cái này không cần tính thường xuyên đâu, chỉ cần khi user thay đổi liên quan đến di chuyển vòng tròn home/work trong activity map là tính toán lại được (thậm chí bật tắt quận hay scale radius cũng ko cần chạy lại), lưu thông tin vào db là home thuộc quận này, work thuộc quận này là đủ thông tin rồi
+ [x] Min Distance chuyển default về 0.5 km (v2.0.7)
+ [x] Di chuyển toggle Start Near Favorite Place sang card Map & Priority Areas (v2.0.7)
+ [x] Sửa đổi toàn bộ mã Product ID (BIN) cho Garmin và Manufacturer ID cho Huawei, Coros, Amazfit/Zepp, Polar, Strava theo tài liệu Garmin_BIN_Format và ANT+ SDK (v2.0.8)
+ [x] Khảo sát tài liệu Strava Device Mapping, đối chiếu tính đầy đủ và chuẩn xác của các trường dữ liệu FIT (đặc biệt là các trường thời gian như local_timestamp, start_time...) (v2.0.9)
+ [x] Nghiên cứu tài liệu chính thống Garmin FIT SDK và ANT+ Alliance, phân tích cơ chế map thiết bị phi-Garmin bằng fallback product_name, cập nhật tài liệu testcase thiết bị (v2.1.0)
+ [x] Khảo sát tài liệu tương thích Strava Live Segments (Garmin, Coros, Suunto), loại bỏ các thiết bị fictional (giả tưởng), bổ sung các dòng mới (Forerunner 745/245, Venu 3/3S, Enduro 3, Fenix E) và cập nhật Product ID chuẩn từ FIT SDK (v2.1.1)
+ [x] Loại bỏ các nhãn (Source) / (App) khỏi danh sách thiết bị để tránh sai lệch tên, đồng thời khôi phục Instinct 3, Forerunner 570/970 sau khi xác minh ra mắt thực tế năm 2025 (v2.1.2)
+ [x] Dọn dẹp danh sách thiết bị, loại bỏ các dòng Garmin Forerunner 945 và 245 ra mắt trước năm 2020 theo yêu cầu người dùng (v2.1.3)
+ [x] dùng gotoes fit-file-viewer và fitfileviewer debug ra được thông tin chưa thực tế: (serial number: 1234567, software version: 200) -> s/n thì random chữ thường và số hợp lý (số nhiều hơn - defined theo thiết bị vào database/config hardcode), software version thì search thông tin và chọn 1 version lts uy tín chung cho cùng 1 hãng thiết bị (v2.1.4)
+ [x] cho phép cấu hình custom time áp dụng cho shedule (hiện chỉ áp dụng với generate, generate và upload), nhưng tự động tắt sau 1 lần thực thi schedule -> tức người dùng có thể cài đặt custom time để chạy trong next schedule tiếp theo (nếu activity count random ra lớn hơn 0), thì tính activity đầu tiên random ra sẽ ăn theo giờ của custom time, sau đó toggle custom time được đặt về tắt (default), các activity count sau (2,3) thì vẫn random bình thường, vẫn có thể fail nếu không có khung giờ phù hợp (v2.1.4)
+ [x] tiếp tục edit script test_devices.js để xuất và parse toàn bộ thông tin danh sách thiết bị cần test xuất ra folder ./tmp/fit-testcase/ để tôi check manual trên các trang web preview fit file (v2.1.4)
+ [x] đúc kết kết quả nghiên cứu là gì, làm thế nào để hiển thị source như Garmin Connect, Strava App, Huawei Health,... như gpx trước đó đã làm được đây, device product id thì phải test rồi, có phương án nào hay hơn không (v2.1.4)
+ [x] check logic Custom time nếu được bật thì sẽ gen chính xác tại thời gian chỉ định, bỏ qua giới hạn của Global Random Time, trừ khi Custom time đặt là 00:00 thì sẽ sinh hoạt động ngẫu nhiên trong ngày (default) (v2.1.4)
+ [x] viết docs sử dụng mindmap markdown, mô tả luồng khi gen 1 hoạt động sẽ qua những flow nào để chọn, tỉ lệ bao nhiêu, điều kiện rẽ nhánh, step by step, cái nào chạy trước chạy sau,... (v2.1.4)
+ [x] refact toàn bộ keyword, chức năng liên quan đến "normal account" đổi tên thành "basic account" trong DB và UI (v2.1.4)
+ [x] Sửa lỗi Local Generated History hiển thị tag 2 quận xa nhau dù route thực tế chỉ chạy trong 1 quận: lưu tag theo quận thực sự đi qua sau khi route đã trim theo distance, đồng thời ràng buộc multi-district chỉ chọn quận liền kề (v2.1.8)
+ [x] [quan trọng] khôi phục tính năng tạo với gpx (gfx), song song với fit, do fit lỗi ko nhận diện các thiết bị non-garmin, đồng thời chuẩn hóa tên file theo định dạng thực tế và hiển thị tag phân loại tệp tin trên UI (v2.2.0)
+ [x] Sửa tĩnh nhãn các nút bấm và OSRM Routing trên UI (Generate Activity Only và Snap OSRM Routing), di chuyển toàn bộ tệp tin GPX/FIT vào chung thư mục 'data/activity', và đặt tên file GPX theo dạng 'run_YYYY-MM-DDTHH-mm-ss.gpx' (v2.2.1)
+ [x] Cập nhật Manufacturer ID cho Huami (88) và Coros (264) trong FIT generator để hiển thị đúng tên thiết bị non-Garmin trên Strava; đồng thời hướng dẫn người dùng chuyển sang định dạng FIT (v2.2.2)
+ [x] Loại bỏ cấu hình "Max Districts per Route", cho phép sinh lộ trình tự do và kiểm tra chéo các quận đã xâm phạm bằng Ray-Casting; bổ sung tùy chọn hiển thị "Strava Visibility" (Public/Private/Followers) hỗ trợ dev test bằng cách Mute hoạt động trên Strava (v2.2.3)
+ [x] Sửa lỗi vỡ layout 2 cột từ việc thiếu thẻ đóng div của Allowed Districts và loại bỏ checkMaxSpan thừa (v2.2.4)
+ [x] Sửa lỗi hiển thị thiết bị nguồn Strava cho dòng Zepp/Amazfit (tương thích FIT & GPX) (v2.2.5)
+ [x] Chuyển dấu phân cách lên trên Snap OSRM Routing & Boost Adjacent trong Route Configuration (v2.2.6)
+ [x] Sửa lỗi Invalid field 'source' for message 'device_info' khi tạo cấu hình FIT cho Amazfit/Zepp (v2.2.7)
+ [x] Lưu và khôi phục target_date của Custom Time khi lưu cấu hình (saveConfig) (v2.2.8)
+ [x] Cấu hình hoãn lập lịch (Pending Scheduler) khi bật Custom Time và cho phép chọn ngày tương lai (v2.2.9)
+ [x] Hoàn thiện logic Custom Target Time (00:00 vs cụ thể) & Giới hạn đặt lịch tương lai (Basic 3 ngày, VIP 7 ngày) kèm banner hướng dẫn ở thẻ Auto Schedule (v2.3.0)
+ [x] Sửa lỗi getOverrideConfig gán cứng min_time/max_time khi dùng custom time 00:00 và ẩn thông tin Pending khi target_date đã ở quá khứ (v2.3.1)
+ [x] Sửa lỗi mất cấu hình time slot 2 khi reload (race condition userRole), chuyển Auto Save sang Save buttons (scheduler, daily max activities), và cập nhật Pending status tức thời trên UI (v2.3.2)
+ [x] Sửa lỗi click vào rìa thẻ mốc thời gian 2 cũng bị đóng bằng cách tách button ra khỏi label (v2.3.3)
+ [x] Cập nhật cơ chế hiển thị Pending chỉ update sau khi click Save trong Time Configuration; nút bật/tắt Auto Schedule chỉ lưu khi click nút Save của thẻ (v2.3.4)
+ [x] Thay thế toàn bộ locale 'en-CA' sang 'sv-SE' để giữ định dạng YYYY-MM-DD chuẩn mà không dùng mã vùng Canada; đồng thời gán 'lang="vi-VN"' cho toàn bộ các thẻ input time để ép hiển thị định dạng 24h (v2.3.5)
+ [x] Đồng bộ và chuẩn hóa logic lọc hoạt động active cho bộ sinh GPX và FIT, đảm bảo bỏ qua các hoạt động có trạng thái 'failed', 'deleted', hoặc 'removed' trong khi kiểm tra trùng lặp (v2.3.6)
+ [x] Review và loại bỏ các tham chiếu cuối cùng đến vai trò 'normal' trong config và regex UI (thay thế bằng 'basic'); dọn dẹp khối mã nguồn di trú database cũ trong sqlite-db.js (v2.3.7)
+ [x] Sửa đổi và chuẩn hóa ánh xạ thiết bị và định dạng GPX/FIT tương ứng theo DEVICE_TESTCASES.md (v2.3.8)
+ [x] Cập nhật và đồng bộ tùy chọn thiết bị, loại bỏ thiết bị không nhận trên Strava theo DEVICE_TESTCASES.md (v2.3.9)
+ [x] Sửa logic Boost Adjacent chỉ áp dụng với quận start của hoạt động upload gần nhất và cho phép cấu hình user age từ 6 đến 85 tuổi (v2.3.10)
+ [x] Fix lỗi nghiêm trọng scheduler: biến stravaActivities global gây spam tạo max hoạt động, config snapshot stale gây sai target_date, loại bỏ giá trị đặc biệt 'Hôm nay' từ target_date, escape HTML trong error_message tooltip (v2.3.11)
+ [x] đổi màu nhãn FIT (xanh lá) và GPX (cam) ở Local Generated History (v2.3.12)
+ [x] Đặt Rest Time mặc định về 40% (v2.3.13)
+ [x] Bổ sung Công viên Hoàng Văn Thụ vào danh sách POI chạy bộ của quận Hoàng Mai (v2.3.14)
+ [x] Dọn dẹp cấu hình max_district_span đã deprecated, tăng cự ly vòng lặp thực tế, tối ưu hóa thuật toán chọn tọa độ ngẫu nhiên trong boundary của quận (v2.3.15)
+ [x] Thiết kế thuật toán điều tuyến thông minh qua các POI chạy bộ trung gian và tối ưu hóa tuyến đường khứ hồi (v2.3.16)
+ [x] Thiết kế xác suất khứ hồi ngẫu nhiên (Point-to-Point) và tỉ lệ dừng tại POI đích (v2.3.17)
+ [x] Hoàn thiện quy tắc khứ hồi linh hoạt cho Home/Work/Random, chạy mặc định P2P kết thúc ngẫu nhiên và nâng trọng số Random (rush) thành 60% Ride, 30% Run, 10% Walk (v2.3.19)
+ [x] Thiết kế cơ chế khóa phân tán SQLite Placeholder đồng bộ scheduler đa tiến trình (v2.3.20)
+ [x] Khắc phục lỗi timezone khi parse/so sánh thời gian khóa scheduler tránh trùng lặp hoạt động; sửa lỗi lưu trạng thái Custom Time trên UI điện thoại và tối ưu hóa việc kiểm tra dailyMaxActivity trước khi sinh hoạt động (v2.3.21)
+ [x] Phát hành phiên bản chính thức v2.4.0 với đầy đủ các bản vá timezone scheduler lock, đồng bộ giờ giữa local và Strava, sửa UI Custom Time trên điện thoại, khóa trùng lặp phân tán SQLite Placeholder, và tối ưu hóa hiệu năng sinh hoạt động (v2.4.0)
+ [x] Tối ưu hóa vòng đời tiến trình LiteSpeed Node.js (lsnode), bổ sung cơ chế Timeout cứng và dọn dẹp kết nối mạng (Strava, OSRM, Google Fit), và đóng kết nối Database khi nhận tín hiệu Shutdown (v2.4.1)
+ [x] update docs/ARCHITECTURE.md: 🔍 Garmin FIT SDK & ANT+ Device Mapping & Time Standards -> chuyển thành dạng flowchart, các phần lý thuyết chuyển sang docs khác (README, AI RULES,...) (v2.4.2)
+ [x] update docs/ARCHITECTURE.md: bỏ phần ⚙️ Device Metadata Hashing -> cái này cho vào docs khác (README, AI RULES,...) (v2.4.2)
+ [x] update docs/ARCHITECTURE.md: phần 🚀 Activity Generation Flowchart lỗi cú pháp mermaid (v2.4.2)
+ [x] update docs/ARCHITECTURE.md: tổng hợp chung vào 1 flowchart về tiến trình lựa chọn, thứ tự, tỉ lệ, các option khi gen hoạt động: 🚀 Activity Generation Flowchart, 🏡 Weighted District Selection & Boost Logic, Thuật toán điều tuyến thông minh đến POI (Smart POI-to-POI Routing) -> vào thành 1 cái chung thôi (v2.4.2)
+ [x] Xác minh và điều chỉnh tiến trình trigger tự động và thủ công của flowchart hoạt động, giải quyết cảnh báo Mermaid, cập nhật trường `created_at` trong ER diagram, và tài liệu hóa chi tiết cơ chế ghi đè tạm thời (Manual Overrides) tại README.md và AI_RULES.md (v2.4.3)
+ [x] cấu hình max, max distance lớn/nhỏ hơn hoặc bằng, min=max để random chính xác, nâng giới hạn vip lên min 10km
+ [x] thiết kế ý tưởng sinh hoạt động chạy gần tôi dựa trên vị trí định vị (mobile) hoặc thả ghim vị trí (pc) áp dụng trước tiếp cận bất kỳ khu vực nào (ngoài HN) -> giả sử tôi đi chơi du lịch nhưng vẫn muốn chạy bộ quanh bãi biển cho uy tín, thì lấy vị trí hiện tại rồi random chạy quanh đó -> đây là nút bấm 1 lần ở cạnh nút Generate and upload (vẫn tuân thủ các rule generate hoạt động, chỉ khác ở phần random vị trí và quận thôi) (v2.6.0)
+ [x] review và xử lý logic override param khi sửa trên UI khi gen hoạt động manual cho toàn bộ config (một số cái còn thiếu) (v2.6.0)
+ [x] mở 2 schedule count cho basic account, tăng max 3 schedule cho vip account
+ [x] cấu hình nút (default enable) giới hạn khung giờ liên quan cho shedule -> mỗi schedule sẽ có khoảng thời gian tạo ra hoạt động trước đó tối đa 8h thay vì schedule nào cũng random full ngày (tất nhiên vẫn tuân thủ gloabal time bound và workhour, safe time, rest time) -> mục đích ngày có 2 schedule sẽ tạo 2 hoạt động 1 sáng sớm, 1 tối, còn giờ làm việc thì vẫn skip, tránh tạo 2 hoạt động vào cùng buổi sáng nhưng tối mới đồng bộ hoặc tương tự
+ [x] cho phép tùy chỉnh loại bản đồ (5 loại): CartoDB Dark Matter, OpenStreetMap Standard, CartoDB Voyager, CartoDB Positron, Esri World Imagery. Đồng bộ cấu hình vào DB và hỗ trợ override param khi gen hoạt động manual. Nâng version lên v2.7.0 (v2.7.0)
+ [x] generate around location: đặt loại hoạt động theo hệ thống (mặc định) bị lỗi báo Please select at least 1 Loại hoạt động (v2.8.2)
+ [x] bỏ option Khoảng cách chạy (km) trong generate around location, thay thành nút toggle (default off) Bypass avoid workhour (v2.8.2)
+ [x] đổi tên tittle của popup khi nhấn generate around location thành Preview Map (v2.8.2)
+ [x] generate around location: lấy 1 vị trí tại tâm hà nội (bạch mai) làm default fallback value và luôn lưu lại previous location value. Luồng lấy vị trí của preview map sẽ như sau: previous saved location -> nếu ko có thì lấy fallback location, khi user move ghim vị trí hoặc ấn nút Định vị GPS thì vị trí mới thay đổi (v2.8.3)
+ [x] fix lỗi tooltip Loại bản đồ hiển thị
+ [x] nút định vị GPS chỉ lấy vị trí 1 lần tại lúc bấm nút và cập nhật vào vị trí của Preview Map -> đồng thời lưu previous saved location cho vị trí này (v2.8.3)
+ [x] với hành động user tự move ghim vị trí thì không lưu previous saved location mà chỉ khi hoạt động generate around location được tạo (Nháp/Upload) thì mới lưu vị trí đó vào previous location (v2.8.3)
+ [x] check lại hàm lấy vị trí đang chưa đúng Phường Bến Thành, Thành phố Thủ Đức (10.7701, 106.6951) -> Thành phố hồ chí minh, ngoài ra một số khu vực chỉ có tên phường, ko có tên thành phố??? (Hà Nội, Nam Định, và các khu vực miền Trung,...)
+ [x] cấu hình tùy chỉnh quyền riêng tư đang sai, tôi đặt chỉ mình tôi nhưng hoạt động vẫn tạo ra vẫn là công khai (v2.8.1)
+ [x] fix lỗi hiển thị strava app (v2.8.0)
+ [x] Bổ sung các địa danh chạy bộ thiếu vào registry, xóa bỏ giới hạn quận (Cross-District POI), và tăng tính đa dạng bằng cách chọn ngẫu nhiên weighted top 3 POI gần nhất (v2.8.5)
+ [x] Bổ sung thêm nhiều công viên, vườn hoa, hồ nước nổi tiếng ở Hà Nội vào registry cho tất cả các quận (v2.8.6)
+ [x] Khôi phục toàn bộ các địa danh chạy bộ đã xóa trong docs/HANOI_POIS.md, cấu hình Sóc Sơn (soc_son) và Sơn Tây (son_tay) thành các quận chính thức thay vì ngoại tỉnh, đồng thời đồng bộ hóa hoàn toàn danh sách tọa độ với backend code route-engine.js (v2.8.7)
+ [x] Điều chỉnh tỉ lệ xác suất chọn POI trong route-engine.js: điểm xuất phát POI→80%/20%, waypoint POI-to-POI→60%, Home/Work-to-POI→75%, Random-to-POI→90%; cập nhật weighted top-3 selection thành 50%/30%/20% (v2.8.8)
+ [x] Đổi màu tag FIT từ xanh lá sang cyan/teal (#06b6d4) để tránh trùng với SCHEDULE; tag quận font-size 0.7em + capitalize; label type giữ nguyên uppercase (v2.8.9)
+ [x] sắp xếp lại các địa danh trong HANOI_POIS.md theo từng quận trong HANOI DISTRICTS (v2.9.0)
+ [x] test và check chéo mapping vị trí các địa danh trong HANOI_POIS.md với tọa độ thực tế trên bản đồ có đúng với các quận được khai báo trong POI nổi tiếng trong code không (v2.9.0)
+ [x] big update: Làm endpoint trigger để tạo hoạt động theo location hiện tại, payload gồm user token và định vị (lat/lon) (v3.0.0)
+ [x] Thêm chức năng liên quan đến user token để tự động hóa khi không cần login, publish một số api, đảm bảo an toàn, bảo mật, tránh brute force, cógiao diện tạo token, revoke token (v3.0.0)
+ [x] các hoạt động tạo bằng API sẽ có Label type: API (ngoài MANUAL, CUSTOM, SCHEDULE 1,2,3) (v3.0.0)
+ [x] đổi css cho hiển thị nhãn Label type (MANUAL/API/CUSTOM/SCHEDULE1,2,3) cho dễ phân biệt và thẩm mỹ hơn trong Local Generated History
+ [x] các nhãn vị trí của các hoạt động trong Local Generated History move lên cạnh tên hoạt động
+ [x] review và điều chỉnh lại global rate limiter đang là bao nhiêu cho phù hợp với việc tạo hoạt động liên tục, tránh bị block nhưng cũng không quá nhiều (1000req), đặt rate limit theo từng đầu api và lượng nhỏ, phù hợp với user action, ngoài ra các endpoint dạng POST cũng phải đẩy thấp hơn (v3.1.0)
+ [x] thiết kế trang block và mã status trả về cho các loại security violation (403, 429, 500) (v3.0.0)
+ [x] thiết kế lại nút bypass workhour trong generate around location thành dạng toggle giống mẫu config chung của dự án (viết/update tài liệu về quy định thiết kế của dự án để nhớ) (v3.0.0)
+ [x] review lại thiết kế các chức năng basic account không có thì chỉ disable thôi, không hidden để cho user biết mà tò mò chứ (v3.0.0)
+ [x] giao diện quản lý và edit danh sách api token tôi nghĩ nên để popup lên cho gọn, edit inline tại bảng thế không tối ưu, ngoài ra whitelist IP là dạng mảng nữa nên khá dài, cũng không nên view luôn ở giao diện, phần view sẵn chỉ cần hiển thị tên với thời hạn là được, muốn xem chi tiết, sửa, xóa, edit, copy thì ấn 1 nút sẽ hiện popup lên xong làm gì thì làm (v3.2.0)
+ [x] fix lỗi Error creating token: createApiToken is not defined (v3.2.0)
+ [x] cấu hình tối giản cơ chế xác thực Token (chỉ giữ Authorization Bearer & query parameter) và tích hợp Modal hướng dẫn sử dụng API trên giao diện (v3.3.0)
+ [x] fix lại device name của Strava App cho hoạt động chạy bộ (chuẩn hóa gpxActivityType: running/walking/cycling & Strava App creator/FIT mapping) (v3.3.1)
