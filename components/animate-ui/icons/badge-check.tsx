'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@/components/animate-ui/icons/icon';

type BadgeCheckProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    path1: {
      initial: { scale: 1 },
      animate: {
        scale: [1, 0.9, 1],
        transition: {
          duration: 1.2,
          ease: 'easeInOut',
        },
      },
    },
    path2: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [1, 0, 1],
        transition: {
          duration: 1.2,
          ease: 'easeInOut',
          opacity: { duration: 0.01 },
        },
      },
    },
  } satisfies Record<string, Variants>,
  check: {
    path2: {
      initial: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: [0, 1],
        transition: {
          duration: 0.6,
          ease: 'easeInOut',
          opacity: { duration: 0.01 },
        },
      },
    },
  } satisfies Record<string, Variants>,
  // Draw → hold → VANISH (instant) → gap → redraw.
  // opacity is a SQUARE WAVE only — hard cuts to hide the pathLength:0 line-cap
  // dot during the gap. The draw itself is pure pathLength with opacity locked
  // at 1 the entire time, so there is NO fade — the stroke grows solid.
  //   0–5%:    gap (pl 0, op 0) — invisible, no dot
  //   5%:      INSTANT appear (op 0→1 in 0.22ms) right as the draw begins
  //   5–50%:   draw (pl 0→1, op locked 1) — solid stroke grows, no fade
  //   50–70%:  hold (both 1)
  //   70%:     INSTANT vanish (both 1→0 in 0.22ms)
  //   70–100%: gap (both 0)
  //   → loop:  endpoints match (both 0), instant restart
  'path-appear-loop': {
    path1: {
      initial: { pathLength: 0, opacity: 0 },
      animate: {
        pathLength: [0, 0, 0, 1, 1, 0, 0],
        opacity: [0, 0, 1, 1, 1, 0, 0],
        transition: {
          duration: 2.2,
          ease: 'easeInOut',
          times: [0, 0.0499, 0.05, 0.5, 0.7, 0.7001, 1],
        },
      },
    },
    path2: {
      initial: { pathLength: 0, opacity: 0 },
      animate: {
        pathLength: [0, 0, 0, 1, 1, 0, 0],
        opacity: [0, 0, 1, 1, 1, 0, 0],
        transition: {
          duration: 2.2,
          ease: 'easeInOut',
          times: [0, 0.0499, 0.05, 0.5, 0.7, 0.7001, 1],
        },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: BadgeCheckProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        variants={variants.path1}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={variants.path2}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function BadgeCheck(props: BadgeCheckProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export {
  animations,
  BadgeCheck,
  BadgeCheck as BadgeCheckIcon,
  type BadgeCheckProps,
  type BadgeCheckProps as BadgeCheckIconProps,
};
