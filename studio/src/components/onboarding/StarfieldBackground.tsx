import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface StarfieldBackgroundProps {
  className?: string;
}

const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({ className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    stars: THREE.Points;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 创建场景
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0a2e, 0.001);

    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 1000;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 创建星星粒子系统
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    // 生成星星位置
    const starsVertices: number[] = [];
    const starsColors: number[] = [];
    const starCount = 5000;

    for (let i = 0; i < starCount; i++) {
      // 随机位置
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);

      // 紫色系随机颜色
      const colorChoice = Math.random();
      let r, g, b;
      if (colorChoice < 0.3) {
        // 白色星星
        r = 1; g = 1; b = 1;
      } else if (colorChoice < 0.6) {
        // 紫色星星
        r = 0.8; g = 0.6; b = 1;
      } else if (colorChoice < 0.8) {
        // 靛蓝色星星
        r = 0.5; g = 0.5; b = 1;
      } else {
        // 粉紫色星星
        r = 1; g = 0.6; b = 0.9;
      }
      starsColors.push(r, g, b);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    starsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(starsColors, 3)
    );

    starsMaterial.vertexColors = true;
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // 保存原始颜色数组用于闪烁动画
    const starsColorsArray = [...starsColors];

    // 添加一些大星星（更亮）
    const bigStarsGeometry = new THREE.BufferGeometry();
    const bigStarsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 4,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const bigStarsVertices: number[] = [];
    const bigStarsColors: number[] = [];
    const bigStarCount = 200;

    for (let i = 0; i < bigStarCount; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      bigStarsVertices.push(x, y, z);

      // 更亮的紫色
      const r = 0.9 + Math.random() * 0.1;
      const g = 0.7 + Math.random() * 0.2;
      const b = 1;
      bigStarsColors.push(r, g, b);
    }

    bigStarsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(bigStarsVertices, 3)
    );
    bigStarsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(bigStarsColors, 3)
    );

    bigStarsMaterial.vertexColors = true;
    const bigStars = new THREE.Points(bigStarsGeometry, bigStarsMaterial);
    scene.add(bigStars);
    
    // 保存原始颜色数组用于闪烁动画
    const bigStarsColorsArray = [...bigStarsColors];

    // 动画循环
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.005; // 减慢时间流逝速度

      // 非常缓慢的旋转，几乎不可察觉
      stars.rotation.y += 0.00005;
      bigStars.rotation.y -= 0.00003;

      // 让星星轻微闪烁，变化幅度很小
      const colors = starsGeometry.attributes.color.array as Float32Array;
      for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // 非常缓慢的闪烁，幅度很小
        const frequency = 0.1 + (i % 20) * 0.01;
        const phase = i * 0.001;
        const opacity = 0.7 + Math.sin(time * frequency + phase) * 0.15; // 减小闪烁幅度
        
        // 使用原始颜色值乘以透明度
        colors[i3] = starsColorsArray[i3] * opacity;
        colors[i3 + 1] = starsColorsArray[i3 + 1] * opacity;
        colors[i3 + 2] = starsColorsArray[i3 + 2] * opacity;
      }
      starsGeometry.attributes.color.needsUpdate = true;
      
      // 大星星也轻微闪烁
      const bigColors = bigStarsGeometry.attributes.color.array as Float32Array;
      for (let i = 0; i < bigStarCount; i++) {
        const i3 = i * 3;
        const frequency = 0.08 + (i % 10) * 0.01;
        const phase = i * 0.002;
        const opacity = 0.8 + Math.sin(time * frequency + phase) * 0.15; // 减小闪烁幅度
        
        bigColors[i3] = bigStarsColorsArray[i3] * opacity;
        bigColors[i3 + 1] = bigStarsColorsArray[i3 + 1] * opacity;
        bigColors[i3 + 2] = bigStarsColorsArray[i3 + 2] * opacity;
      }
      bigStarsGeometry.attributes.color.needsUpdate = true;

      // 移除相机移动，保持静态视角，避免PPT切换感
      // camera.position.x = Math.sin(time * 0.1) * 50;
      // camera.position.y = Math.cos(time * 0.15) * 50;

      renderer.render(scene, camera);
    };

    animate();

    // 处理窗口大小变化
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // 保存引用以便清理
    sceneRef.current = {
      scene,
      camera,
      renderer,
      stars,
      animationId,
    };

    // 清理函数
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      bigStarsGeometry.dispose();
      bigStarsMaterial.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{ background: "linear-gradient(to bottom, #1a0a2e, #16213e, #0f3460)" }}
    />
  );
};

export default StarfieldBackground;

