/** Services page (screen 05). Lift to a Strapi single type `services-page` with a repeatable `service` component. */
export interface ServiceItem {
  title: string;
  subtitle: string;
  /** The flow, in order; the page joins it with arrows. */
  steps: string[];
  /** Where "send a service request" goes: the warranty form flow (P3) or the general contact page. */
  target: 'contact' | 'warranty';
}
export const services = {
  kicker: 'Dịch vụ V-ROBOTICS',
  title: 'Đồng hành trọn vòng đời robot',
  subtitle: 'Từ lựa chọn phương án đầu tư đến triển khai, vận hành và hỗ trợ kỹ thuật.',
  items: [
    { title: 'Thuê robot', subtitle: 'Theo ngày • tuần • tháng • sự kiện', steps: ['Nhận yêu cầu', 'kiểm tra robot đối tác', 'báo giá'], target: 'contact' },
    { title: 'Mua trả góp', subtitle: 'Tư vấn phương án tài chính', steps: ['Tiếp nhận nhu cầu', 'thẩm định', 'chốt điều kiện'], target: 'contact' },
    { title: 'Bảo hành / sửa chữa', subtitle: 'Tạo và theo dõi phiếu hỗ trợ', steps: ['Mã robot', 'mô tả lỗi', 'hình ảnh/video', 'kỹ thuật'], target: 'warranty' },
    { title: 'Triển khai / tích hợp', subtitle: 'Khảo sát và đào tạo vận hành', steps: ['Khảo sát', 'giải pháp', 'nghiệm thu', 'hỗ trợ'], target: 'contact' },
  ] satisfies ServiceItem[],
  footnote: 'Các điều kiện thuê, tài chính và bảo hành phải được xác nhận trước khi cam kết với khách hàng.',
};
