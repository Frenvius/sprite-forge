// Subscribes to a shared rAF clock instead of spawning its own loop,
// so N visible animated sprites share one rAF callback per frame.

import type { ThingType, FrameDuration, ThingCategory } from '~/lib/formats/tibia/types.ts';

import { useRef, useState, useEffect, useCallback } from 'react';

import { animationClock } from '~/lib/animationClock.ts';
import {
	getLoopFrame,
	getStartFrame,
	getFrameDuration,
	getPingPongFrame,
	AnimationDirection,
	shouldSkipFirstFrame,
	generateDefaultDurations
} from '~/lib/formats/tibia/animation.ts';

export interface AnimatorState {
	isPlaying: boolean;
	isComplete: boolean;
	currentFrame: number;
}

export interface AnimatorControls {
	play: () => void;
	stop: () => void;
	pause: () => void;
	reset: () => void;
	setFrame: (frame: number) => void;
}

export interface UseAnimatorOptions {
	thing: ThingType;
	autoPlay?: boolean;
	category: ThingCategory;
	onComplete?: () => void;
}

export function useAnimator({
	thing,
	category,
	onComplete,
	autoPlay = false
}: UseAnimatorOptions): AnimatorState & AnimatorControls {
	const [currentFrame, setCurrentFrame] = useState<number>(0);
	const [isPlaying, setIsPlaying] = useState(autoPlay && thing.isAnimation);
	const [isComplete, setIsComplete] = useState(false);

	const lastTimeRef = useRef<number>(0);
	const currentFrameDurationRef = useRef<number>(0);
	const currentLoopRef = useRef<number>(0);
	const currentDirectionRef = useRef<number>(AnimationDirection.FORWARD);
	const skipFirstFrameRef = useRef<boolean>(false);
	const frameRef = useRef<number>(0);
	const onCompleteRef = useRef<undefined | (() => void)>(onComplete);

	const durationsRef = useRef<FrameDuration[]>(generateDefaultDurations(thing, category));

	useEffect(() => {
		durationsRef.current = generateDefaultDurations(thing, category);
		skipFirstFrameRef.current = shouldSkipFirstFrame(thing, category);
	}, [thing, category]);

	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	useEffect(() => {
		frameRef.current = currentFrame;
	}, [currentFrame]);

	useEffect(() => {
		if (!isPlaying || !thing.isAnimation) return;

		lastTimeRef.current = 0;
		currentFrameDurationRef.current = getFrameDuration(durationsRef.current[frameRef.current]);

		return animationClock.subscribe((timestamp: number) => {
			if (lastTimeRef.current === 0) {
				lastTimeRef.current = timestamp;
				return;
			}

			const elapsed = timestamp - lastTimeRef.current;
			lastTimeRef.current = timestamp;

			if (elapsed < currentFrameDurationRef.current) {
				currentFrameDurationRef.current -= elapsed;
				return;
			}

			const curr = frameRef.current;
			let nextFrame: number;
			let complete = false;

			if (thing.loopCount < 0) {
				const result = getPingPongFrame(curr, thing.frames, currentDirectionRef.current);
				nextFrame = result.frame;
				currentDirectionRef.current = result.newDirection;
			} else {
				nextFrame = getLoopFrame(curr, thing.frames, thing.loopCount, currentLoopRef.current);
				if (nextFrame === 0 && curr === thing.frames - 1) {
					currentLoopRef.current++;
				}
				if (nextFrame === curr && curr === thing.frames - 1) {
					complete = true;
				}
			}

			if (skipFirstFrameRef.current && nextFrame === 0) {
				nextFrame = 1 % thing.frames;
			}

			if (complete) {
				if (thing.animateAlways) {
					frameRef.current = 0;
					currentLoopRef.current = 0;
					currentDirectionRef.current = AnimationDirection.FORWARD;
					currentFrameDurationRef.current = getFrameDuration(durationsRef.current[0]);
					setCurrentFrame(0);
					setIsComplete(false);
				} else {
					setIsComplete(true);
					setIsPlaying(false);
					onCompleteRef.current?.();
				}
				return;
			}

			frameRef.current = nextFrame;
			setCurrentFrame(nextFrame);

			const duration = getFrameDuration(durationsRef.current[nextFrame]);
			const overshoot = elapsed - currentFrameDurationRef.current;
			const remaining = duration - overshoot;
			currentFrameDurationRef.current = remaining < 0 ? 0 : remaining;
		});
	}, [isPlaying, thing.isAnimation, thing.loopCount, thing.frames, thing.animateAlways]);

	const play = useCallback(() => {
		if (thing.isAnimation) {
			setIsPlaying(true);
			setIsComplete(false);
		}
	}, [thing.isAnimation]);

	const pause = useCallback(() => {
		setIsPlaying(false);
	}, []);

	const stop = useCallback(() => {
		setIsPlaying(false);
		setCurrentFrame(0);
		setIsComplete(false);
		currentLoopRef.current = 0;
		currentDirectionRef.current = AnimationDirection.FORWARD;
		lastTimeRef.current = 0;
	}, []);

	const reset = useCallback(() => {
		setCurrentFrame(thing.startFrame >= 0 ? thing.startFrame : getStartFrame(thing));
		setIsComplete(false);
		currentLoopRef.current = 0;
		currentDirectionRef.current = AnimationDirection.FORWARD;
		lastTimeRef.current = 0;
	}, [thing]);

	const setFrame = useCallback(
		(frame: number) => {
			if (frame >= 0 && frame < thing.frames) {
				setCurrentFrame(frame);
				setIsComplete(false);
				lastTimeRef.current = 0;
			}
		},
		[thing.frames]
	);

	return {
		play,
		stop,
		pause,
		reset,
		setFrame,
		isPlaying,
		isComplete,
		currentFrame
	};
}
