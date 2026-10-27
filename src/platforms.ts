import type { Platform, Selectors } from './core/types';

export const BASE_SELECTORS: Selectors = {
  questions: '[data-ocs-question]', title: '[data-ocs-title]',
  options: '[data-ocs-option]',
  blanks: 'textarea,input:not([type]),input[type="text"],[contenteditable="true"],iframe[id^="ueditor_"]',
  chapters: '[data-ocs-chapter]', active: '.active,.current,.on,[aria-current="true"],[data-active="true"]',
  completed: '.finished,.completed,.time_icofinish,.finished-icon,[data-completed="true"]',
  next: '[data-ocs-next]', documentNext: '[data-ocs-document-next]',
  captcha: '.geetest_panel:has(.geetest_captcha),.yidun_popup,.nc-container,#captcha,[data-ocs-captcha]'
};
const define = (id: string, name: string, hosts: string[], selectors: Partial<Selectors>): Platform => ({ id, name, hosts, selectors: { ...BASE_SELECTORS, ...selectors } });

export const PLATFORMS: Platform[] = [
  define('chaoxing', 'Chaoxing / Xuexitong', [
    'chaoxing.com', 'xueyinonline.com', 'xuexi365.com', 'sslibrary.com', 'edu.cn', 'org.cn',
    'hnsyu.net', 'qutjxjy.cn', 'ynny.cn', 'hnvist.cn', 'fjlecb.cn', 'gdhkmooc.com', 'cugbonline.cn',
    'zjelib.cn', 'cqrspx.cn', 'neauce.com', 'zhihui-yun.com', 'cqie.cn', 'ccqmxx.com', 'jxgmxy.com', 'jnzyjsxy.cn', 'smjyxy.cn'
  ], {
    questions: '.questionLi,.question-item,.TiMu,[data-ocs-question]',
    title: '.mark_name,.line_wid_half,.question-name .html-content-box,.Zy_TItle .clearfix,.Zy_TItle,.question-title,[data-ocs-title]',
    options: '.mark_letter li,.mark_letter .mark_letter_item,.answerBg li,.stem_answer li,.option-result,.Zy_ulTop li,.Zy_ulBottom li,[data-ocs-option]',
    chapters: '.posCatalog_level ul li,.posCatalog_select,.ncells .chapter,.chapter_item,[data-ocs-chapter]',
    next: '#prevNextFocusNext,.nextChapter,[data-ocs-next]',
    documentNext: '.swiper-button-next,.flip-next,#nextPage,[data-ocs-document-next]'
  }),
  define('zhihuishu', 'Zhihuishu', ['zhihuishu.com', 'hike-teaching-center.polymas.com'], {
    questions: '.examPaper_subject,div:has(> .questionContent),.questionContent:has(.questionName),.subject_node:has(.subject_describe),.question-box,[data-ocs-question]',
    title: '.subject_describe > div,.smallStem_describe > div:nth-child(2),.questionName .centent-pre,.questionContent,.question-stem,[data-ocs-title]',
    options: '.subject_node .nodeLab,.optionUl label,.radio-view li.clearfix,.checkbox-views label.el-checkbox,.option-item,[data-ocs-option]',
    chapters: '.clearfix.video,.video_item,.catalogue_list li,.collapse-item-sub,.section-item-collapse-info,.chapter-item,.resource-box .resource-item,[data-ocs-chapter]',
    next: '.next-lesson,.nextBtn,[data-ocs-next]', documentNext: '.next-page,.swiper-button-next,[data-ocs-document-next]'
  }),
  // Specific ICVE hosts precede the shared base domain to avoid ambiguous ownership.
  define('icve', 'ICVE / Smart Vocational Education', ['course.icve.com.cn', 'mooc.icve.com.cn', 'ai.icve.com.cn', 'courshare.cn', 'webtrn.cn'], {
    questions: '.q_content,.content-item:has(.questions-content),[data-ocs-question]',
    title: '.divQuestionTitle,[name="fillblankTitle"],.questions-content [class*="title-content"],[data-ocs-title]',
    options: '.questionOptions .q_option,.answerOption,label[class*="group-item"],[data-ocs-option]',
    chapters: '.s_chapter .s_point,.chapter-list .item,.resource-item,[data-ocs-chapter]',
    documentNext: '.next-page,.btn-next,[data-ocs-document-next]'
  }),
  define('zjy', 'ZJY / Vocational Cloud', ['icve.com.cn'], {
    questions: '.subjectDet,[data-ocs-question]',
    title: 'h2,h3,h4,h5,h6,.titleTest span:not(.xvhao),[data-ocs-title]',
    options: '.optionList > div,.optionList label,[data-ocs-option]',
    chapters: '.classroomNow .res-item,.chapter-list .resource,.catalog-list .item,[data-ocs-chapter]',
    documentNext: '.next-page,.el-pagination .btn-next,[data-ocs-document-next]'
  }),
  define('icourse', 'iCourse / China University MOOC', ['icourse163.org'], {
    questions: '[class*="questionBody"],.u-questionItem,[data-ocs-question]',
    title: '[class*="questionInfo"],.j-title .j-richTxt,[data-ocs-title]',
    options: '[class*="index-module__optionBody"],.choices li,[data-ocs-option]',
    chapters: '.u-learnLesson .j-unit,.u-learn-lessonunit,.lesson-list .item,[data-ocs-chapter]',
    documentNext: '.j-next,.next-page,[data-ocs-document-next]'
  }),
  define('yuketang', 'Yuketang / Rain Classroom', ['yuketang.cn', 'gdufemooc.cn', 'xuetangx.com'], {
    questions: '.subject-item:has(.problem-body),.subject-item:has(.item-body),.problem-item,[data-ocs-question]',
    title: '.problem-body,.item-body > div:first-child,.problem-title,[data-ocs-title]',
    options: 'ul[class*="list-unstyled"] li label,.problem-body label,[data-ocs-option]',
    chapters: '.leaf-detail,.leaf-item,.chapter-list .leaf,.section-item,[data-ocs-chapter]',
    next: '.next-leaf,[data-ocs-next]', documentNext: '.btn-next,.next-page,[data-ocs-document-next]'
  })
];

export function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectPlatform(hostname: string): Platform | undefined {
  return PLATFORMS.find(platform => platform.hosts.some(domain => hostnameMatches(hostname.toLowerCase(), domain)));
}
