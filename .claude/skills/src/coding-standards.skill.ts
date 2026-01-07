/**
 * 代码规范检查 Skill
 *
 * 用于检查项目代码是否符合团队制定的编码规范标准
 * 包括命名规范、代码格式、注释规范等
 */

/**
 * Skill 配置对象
 */
export const codingStandardsSkill = {
  /**
   * Skill 名称标识符
   */
  name: 'coding-standards',

  /**
   * Skill 显示名称
   */
  displayName: '代码规范检查',

  /**
   * Skill 描述
   */
  description: '检查项目代码是否符合团队编码规范，包括命名规范、代码格式、注释规范等',

  /**
   * Skill 版本
   */
  version: '1.0.0',

  /**
   * Skill 标签
   */
  tags: ['代码质量', '规范检查', '最佳实践'],

  /**
   * 使用场景
   */
  useCases: [
    '代码审查前的规范检查',
    '新代码提交前的自动检查',
    '团队编码规范培训',
  ],

  /**
   * 检查项配置
   */
  checkItems: {
    /**
     * 命名规范
     */
    naming: {
      enabled: true,
      rules: [
        '变量使用驼峰命名法（camelCase）',
        '常量使用大写下划线命名法（UPPER_SNAKE_CASE）',
        '类名使用帕斯卡命名法（PascalCase）',
        '文件名使用短横线命名法（kebab-case）',
      ],
    },

    /**
     * 注释规范
     */
    comments: {
      enabled: true,
      rules: [
        '函数必须有 JSDoc 注释',
        '复杂逻辑必须添加行内注释',
        '接口和类型必须有描述注释',
      ],
    },

    /**
     * 代码格式
     */
    formatting: {
      enabled: true,
      rules: [
        '使用 2 空格缩进',
        '每行最大长度 100 字符',
        '使用单引号而非双引号',
        '语句末尾添加分号',
      ],
    },

    /**
     * 最佳实践
     */
    bestPractices: {
      enabled: true,
      rules: [
        '避免使用 any 类型',
        '优先使用 const 而非 let',
        '避免嵌套超过 3 层',
        '函数长度不超过 50 行',
      ],
    },
  },
}
