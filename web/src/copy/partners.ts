// SAMPLE-DATA: in every title/body/subtitle below only the first sentence was read off the client's screen; every sentence after it is invented placeholder text. Replace before launch.
/** Partnership page (screen 08). Lift to a Strapi single type `partners-page` with a repeatable `partner-type` component. */
export const partners = {
  kicker: 'Hợp tác trong nước & quốc tế',
  title: 'Cùng phát triển hệ sinh thái robot',
  subtitle: 'Phân phối • Đại lý • Showroom • Tích hợp hệ thống • Nhà sản xuất • Nghiên cứu',
  types: [
    { id: 'distributor', title: 'Đại lý / Nhà phân phối', body: 'Phát triển thị trường và bán giải pháp. Được đào tạo sản phẩm, hỗ trợ kỹ thuật và tài liệu bán hàng; khu vực và chính sách được thỏa thuận theo từng hồ sơ.' },
    { id: 'showroom', title: 'Đối tác showroom', body: 'Tổ chức điểm trưng bày và trải nghiệm. Đối tác cung cấp mặt bằng và đội ngũ đón khách, V-ROBOTICS cung cấp robot trưng bày và nội dung giới thiệu.' },
    { id: 'integrator', title: 'Đối tác tích hợp', body: 'Kết nối phần mềm và tự động hóa. Dành cho đơn vị tích hợp muốn đưa robot vào hệ thống kho, nhà máy hoặc tòa nhà của khách hàng.' },
    { id: 'international', title: 'Đối tác quốc tế', body: 'OEM, công nghệ và hợp tác sản xuất. Trao đổi về linh kiện, phần mềm và khả năng sản xuất chung, kèm điều kiện chuyển giao và bảo mật.' },
    { id: 'research', title: 'Hợp tác nghiên cứu', body: 'Đại học, phòng thí nghiệm, doanh nghiệp. Cung cấp robot và dữ liệu vận hành cho đề tài nghiên cứu, đồng tác giả công bố khi phù hợp.' },
    { id: 'referral', title: 'Giới thiệu dự án', body: 'Kết nối nhu cầu B2B thực tế. Giới thiệu khách hàng đang cần giải pháp robot; mỗi dự án thành công có chính sách ghi nhận riêng.' },
  ],
  formTitle: 'Đăng ký hợp tác',
  formKicker: 'Hồ sơ đối tác',
  closing: 'Mỗi nhóm đối tác có hồ sơ đăng ký và người phụ trách xét duyệt riêng.',
};
