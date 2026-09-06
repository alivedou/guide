#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# 统一目录变量
BASE_DIR="/opt/my-nav"
DATA_DIR="${BASE_DIR}/local_kv_data"
ENV_FILE="${BASE_DIR}/.env"

# 必须以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}错误: 请使用 root 用户或 sudo 运行此脚本！${NC}"
    exit 1
fi

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}检测到未安装 Docker，正在尝试自动安装...${NC}"
    curl -fsSL https://get.docker.com | bash
    systemctl start docker
    systemctl enable docker
fi

# 辅助函数：按任意键返回主菜单
pause_and_back() {
    echo ""
    echo -e "${YELLOW}---------------------------------------------${NC}"
    read -n 1 -s -r -p "按任意键返回主菜单..."
    echo ""
}

# 主菜单函数
show_menu() {
    clear
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}    IKUN 导航网站 VPS Docker 一键傻瓜部署脚本    ${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo -e " 👤  ${YELLOW}项目作者:${NC} adou"
    echo -e " 🔗  ${YELLOW}项目开源地址:${NC} https://github.com/alivedou/CF-nav"
    echo -e "${GREEN}---------------------------------------------${NC}"
    
    # 智能检查并显示当前运行状态
    if [ -f "$ENV_FILE" ] && [ "$(docker ps -q -f name=ikun-navigation -f status=running)" ]; then
        # 从 .env 文件中精准提取 PORT=xxx 后面的数字
        CURRENT_PORT=$(grep -E "^PORT=" "$ENV_FILE" | cut -d'=' -f2)
        # 获取当前 VPS 的外网 IP
        CURRENT_IP=$(curl -s --max-time 2 ifconfig.me)
        # 如果获取外网 IP 失败，用提示词兜底，防止菜单卡死
        CURRENT_IP=${CURRENT_IP:-"您的VPS公网IP"}
        echo -e " 🚀  ${GREEN}当前运行地址:${NC} http://${CURRENT_IP}:${CURRENT_PORT}"
    else
        echo -e " 🚀  ${YELLOW}当前运行状态:${NC} ${RED}未安装或未运行${NC}"
    fi
    
    echo -e "1. ${GREEN}全新安装部署 / 升级版本${NC}"
    echo -e "2. ${RED}彻底卸载并清空数据 (慎选)${NC}"
    echo -e "3. 检查容器运行状态"
    echo -e "4. 查看容器实时运行日志"
    echo -e "5. 退出脚本"
    echo -e "${GREEN}=============================================${NC}"
    read -p "请输入选项 [1-5]: " menu_choice
}

# 安装函数
install_nav() {
    clear
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}               开始全新安装部署               ${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${YELLOW}---> 第一步：准备宿主机工作目录...${NC}"
    mkdir -p "$DATA_DIR"
    cd "$BASE_DIR" || exit

    echo -e "${YELLOW}---> 第二步：配置环境变量...${NC}"
    # 1. PORT
    read -p "1. 请设置网站访问端口 (默认 3000): " NAV_PORT
    NAV_PORT=${NAV_PORT:-3000}

    # 2. JWT_SECRET
    AUTO_JWT=$(date +%s | sha256sum | base64 | head -c 32)
    read -p "2. 请设置 JWT 权限认证密钥 (直接回车自动生成随机高强度密钥): " NAV_JWT
    NAV_JWT=${NAV_JWT:-$AUTO_JWT}

    # 3. CRON_SECRET (后台自动静默生成)
    AUTO_CRON=$(date +%s | md5sum | head -c 16)

    # 进阶项可选交互
    echo -e "\n${YELLOW}=== 以下为进阶可选配置（如不需要，请直接一路回车跳过） ===${NC}"
    echo -e "💡 提示：多 Bot 轮载请用英文逗号隔开，例如: 123:ABC,789:DEF"
    read -p "3. [可选] 请输入 Telegram Bot Token (无则回车跳过): " TG_TOKEN
    read -p "4. [可选] 请输入 Telegram Chat ID (无则回车跳过): " TG_CHAT_ID

    # 4. 镜像地址（支持 Tag 或完整地址，兼容 fork 仓库）
    DEFAULT_IMAGE="ghcr.io/alivedou/ikun_nav:latest"
    echo ""
    echo -e "5. 请输入镜像 Tag 或完整镜像地址"
    echo -e "   - 输入 Tag (如 v1.0.1) → 自动补全为 ghcr.io/alivedou/ikun_nav:xxx"
    echo -e "   - 输入完整地址 (如 ghcr.io/2bdou/ikun_nav:v1.0.0) → 直接使用"
    read -p "   (直接回车默认使用 ${DEFAULT_IMAGE}): " IMG_INPUT

    if [ -z "$IMG_INPUT" ]; then
        FULL_IMAGE="$DEFAULT_IMAGE"
    elif [[ "$IMG_INPUT" == *"/"* ]]; then
        FULL_IMAGE="$IMG_INPUT"
    else
        FULL_IMAGE="ghcr.io/alivedou/ikun_nav:${IMG_INPUT}"
    fi

    # 写入 .env 文件
    cat <<EOF > "$ENV_FILE"
# --------------------------------------------------
#  IKUN NAV 自动生成的生产环境配置
# --------------------------------------------------
PORT=${NAV_PORT}
NODE_ENV=production
JWT_SECRET=${NAV_JWT}
CRON_SECRET=${AUTO_CRON}

# Telegram 通知配置
TELEGRAM_BOT_TOKEN=${TG_TOKEN}
TELEGRAM_CHAT_ID=${TG_CHAT_ID}
EOF
    echo -e "${GREEN}.env 配置文件创建成功！${NC}"

    echo -e "${YELLOW}---> 第三步：初始化持久化数据库目录权限...${NC}"
    chmod -R 777 "$DATA_DIR"

    echo -e "${YELLOW}---> 第四步：拉取镜像与运行容器...${NC}"
    docker pull "$FULL_IMAGE"
    
    # 全自动防冲突：如果已经存在老容器，先删掉再无缝换新
    if [ "$(docker ps -aq -f name=ikun-navigation)" ]; then
        echo -e "${YELLOW}检测到已存在旧容器，正在自动清理以便升级...${NC}"
        docker rm -f ikun-navigation > /dev/null
    fi

    # 运行连招
    docker run -d \
      --name ikun-navigation \
      -p "${NAV_PORT}:${NAV_PORT}" \
      --env-file "$ENV_FILE" \
      -v "${DATA_DIR}:/app/local_kv" \
      --restart always \
      "$FULL_IMAGE"

    echo -e "${YELLOW}---> 第五步：验证运行状态...${NC}"
    sleep 2
    if [ "$(docker ps -q -f name=ikun-navigation -f status=running)" ]; then
        echo -e "${GREEN}=============================================${NC}"
        echo -e "${GREEN}🎉 部署完美成功！${NC}"
        echo -e "后续请直接访问: ${YELLOW}http://$(curl -s ifconfig.me):${NAV_PORT}${NC}"
        echo -e "${GREEN}=============================================${NC}"
    else
        echo -e "${RED}❌ 容器未能成功启动！${NC}"
        echo -e "你可以退出脚本后执行 ${YELLOW}docker logs ikun-navigation${NC} 查看具体闪退原因。"
    fi
    pause_and_back
}

# 卸载函数
uninstall_nav() {
    clear
    echo -e "${RED}=============================================${NC}"
    echo -e "${RED}               危险操作：危险卸载             ${NC}"
    echo -e "${RED}=============================================${NC}"
    read -p "⚠️ 确定要彻底删除容器并清空所有数据吗？此操作不可逆！[y/N]: " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}正在清理容器...${NC}"
        docker rm -f ikun-navigation 2>/dev/null
        echo -e "${YELLOW}正在抹除整个项目工作目录...${NC}"
        rm -rf "$BASE_DIR"
        echo -e "${GREEN}全套环境已一竿子打死，彻底清理干净！${NC}"
    else
        echo -e "${YELLOW}已取消卸载，数据安全。${NC}"
    fi
    pause_and_back
}

# 状态检查函数
check_status() {
    clear
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}               容器运行状态检查               ${NC}"
    echo -e "${GREEN}=============================================${NC}"
    if [ "$(docker ps -aq -f name=ikun-navigation)" ]; then
        docker ps -f name=ikun-navigation
    else
        echo -e "${RED}提示：未检测到名为 ikun-navigation 的容器，请先选择选项 1 进行部署。${NC}"
    fi
    pause_and_back
}

# 日志查看函数
view_logs() {
    clear
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}         查看最新日志 (按 Ctrl+C 退出日志)     ${NC}"
    echo -e "${GREEN}=============================================${NC}"
    if [ "$(docker ps -aq -f name=ikun-navigation)" ]; then
        echo -e "${YELLOW}提示: 正在实时追踪日志，随时可以按 Ctrl+C 终止查看并返回主菜单。${NC}\n"
        docker logs --tail 50 -f ikun-navigation
    else
        echo -e "${RED}提示：未检测到正在运行的容器，无法查看日志。${NC}"
        pause_and_back
    fi
}

# 脚本主循环
while true; do
    show_menu
    case $menu_choice in
        1) install_nav ;;
        2) uninstall_nav ;;
        3) check_status ;;
        4) view_logs ;; 
        5) echo -e "${GREEN}感谢使用，再见！${NC}"; exit 0 ;;
        *) echo -e "${RED}输入错误，请输入 1-5 之间的数字！${NC}"; sleep 1 ;;
    esac
done