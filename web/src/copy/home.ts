/** Homepage prose (no reference screen; designed in docs/architecture.md, "The homepage"). Lift to a Strapi single type `home-page`.
 *  The hero pair is the fallback for site_settings.hero_headline / hero_sub, which may be empty: the hero must read as deliberate without them.
 *  The headline echoes the brand line the About screen already prints; provisional until the client supplies the real one. */
export const home = {
  heroKicker: 'V-ROBOTICS',
  heroFallbackHeadline: 'Robot thông minh. Giải pháp cho thế giới thực.',
  heroFallbackSub: 'Giải pháp robot, phần mềm và dịch vụ được tổ chức theo nhu cầu vận hành thực tế.',
  linesKicker: 'Sản phẩm',
  linesTitle: 'Các dòng robot',
  linesSubtitle: 'Chọn một dòng để xem model, thông số và ngành phù hợp.',
  solutionsKicker: 'Giải pháp',
  solutionsTitle: 'Robot cho từng ngành',
  principlesKicker: 'Về V-ROBOTICS',
  principlesTitle: 'Vì sao chọn V-ROBOTICS',
  servicesKicker: 'Dịch vụ',
  servicesTitle: 'Đồng hành sau khi chọn robot',
  showroomKicker: 'Showroom',
  showroomTitle: 'Trải nghiệm robot trực tiếp',
  aiKicker: 'Công nghệ AI',
  aiTitle: 'Phần mềm và agent đi cùng robot',
  aiTeaserCount: 3,
  leadTitle: 'Cùng xác định giải pháp robot phù hợp',
  leadSubtitle: 'Cho chúng tôi biết môi trường vận hành của bạn, đội ngũ sẽ phản hồi phương án sơ bộ.',
};
