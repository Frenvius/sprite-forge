import { Play, Pause, FileQuestion } from 'lucide-react';
import { useRef, useMemo, useState, useEffect } from 'react';

import { Button } from './ui/button';
import { CheckerBoard } from './CheckerBoard';
import { SpriteCanvas } from './commons/SpriteCanvas';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { loadSpriteIds, getCategoryRenderConfig } from '~/lib/formats/tibia';
import { getPingPongFrame, AnimationDirection } from '~/lib/formats/tibia/animation';

export const VisualizationPanel = () => {
	const { data, getThing, formatConfig, selectedCategory, highlightedItemId, notifySpritesLoaded } = useAssetData();
	const item = highlightedItemId ? getThing(highlightedItemId, selectedCategory) : null;

	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	const itemRef = useRef(item);
	itemRef.current = item;

	const animationState = useRef({
		frame: 0,
		frames: 0,
		lastTime: 0,
		loopCount: 0,
		currentLoop: 0,
		timeRemaining: 0,
		isComplete: false,
		skipFirstFrame: false,
		durations: [] as number[],
		direction: AnimationDirection.FORWARD as number
	});
	const requestRef = useRef<number>();

	useEffect(() => {
		setCurrentFrame(0);
		setIsPlaying(false);
		animationState.current = {
			frame: 0,
			frames: 0,
			lastTime: 0,
			loopCount: 0,
			durations: [],
			currentLoop: 0,
			timeRemaining: 0,
			isComplete: false,
			skipFirstFrame: false,
			direction: AnimationDirection.FORWARD
		};
		if (requestRef.current) {
			cancelAnimationFrame(requestRef.current);
		}
	}, [highlightedItemId, selectedCategory]);

	useEffect(() => {
		if (!data?.sprPath || !item) return;

		const spriteIds = new Set<number>();
		for (const id of item.spriteIndex ?? []) {
			if (id > 0 && !data.sprites.has(id)) spriteIds.add(id);
		}
		if (item.frameGroupsData) {
			for (const group of item.frameGroupsData) {
				for (const id of group.spriteIndex ?? []) {
					if (id > 0 && !data.sprites.has(id)) spriteIds.add(id);
				}
			}
		}

		if (spriteIds.size === 0) return;

		loadSpriteIds(data.sprPath, Array.from(spriteIds), data.transparency, data.sprites).then(() => {
			notifySpritesLoaded();
		});
	}, [highlightedItemId, item, data, notifySpritesLoaded]);

	const itemRenderConfig = useMemo(
		() => (item ? getCategoryRenderConfig(formatConfig, item.category) : undefined),
		[item, formatConfig]
	);

	const animationInfo = useMemo(() => {
		if (!item) return null;

		if (itemRenderConfig?.frameGroups && item.frameGroupsData && item.frameGroupsData.length > 1) {
			const walkingGroup = item.frameGroupsData[1];
			if (walkingGroup && walkingGroup.frames > 1) {
				return { index: 1, group: walkingGroup };
			}
		}

		const idleGroup = item.frameGroupsData?.[0];
		if (idleGroup && idleGroup.frames > 1) {
			return { index: 0, group: idleGroup };
		}

		if (item.frames > 1) {
			return { index: -1, group: null };
		}

		return null;
	}, [item, itemRenderConfig]);
	const hasAnimation = animationInfo !== null;

	const displayThing = useMemo(() => {
		if (!item) return null;

		if (animationInfo?.group && animationInfo.index >= 0) {
			const group = animationInfo.group;
			return {
				...item,
				width: group.width,
				height: group.height,
				frames: group.frames,
				layers: group.layers,
				patternX: group.patternX,
				patternY: group.patternY,
				patternZ: group.patternZ,
				spriteIndex: group.spriteIndex
			};
		}

		return item;
	}, [item, animationInfo]);

	useEffect(() => {
		if (item && hasAnimation) {
			const timer = setTimeout(() => {
				setIsPlaying(true);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [item, hasAnimation]);

	const animate = (time: number) => {
		const state = animationState.current;

		if (state.frames === 0 || state.durations.length === 0 || state.isComplete) {
			return;
		}

		if (state.lastTime === 0) {
			state.lastTime = time;
			requestRef.current = requestAnimationFrame(animate);
			return;
		}

		const elapsed = time - state.lastTime;
		state.lastTime = time;

		if (elapsed >= state.timeRemaining) {
			let nextFrame: number;

			if (state.loopCount < 0) {
				const result = getPingPongFrame(state.frame, state.frames, state.direction);
				nextFrame = result.frame;
				state.direction = result.newDirection;
			} else {
				nextFrame = state.frame + 1;
				if (nextFrame >= state.frames) {
					if (state.loopCount === 0) {
						nextFrame = 0;
					} else if (state.currentLoop < state.loopCount - 1) {
						state.currentLoop++;
						nextFrame = 0;
					} else {
						nextFrame = state.frame;
					}
				}
			}

			if (nextFrame === state.frame) {
				state.isComplete = true;
				setIsPlaying(false);
				return;
			}

			if (state.skipFirstFrame && nextFrame === 0) {
				nextFrame = 1 % state.frames;
			}

			state.timeRemaining = state.durations[nextFrame] - (elapsed - state.timeRemaining);
			if (state.timeRemaining < 0) state.timeRemaining = 0;

			state.frame = nextFrame;
			setCurrentFrame(nextFrame);
		} else {
			state.timeRemaining -= elapsed;
		}

		requestRef.current = requestAnimationFrame(animate);
	};

	useEffect(() => {
		if (isPlaying && item && hasAnimation && animationInfo) {
			const currentGroup = animationInfo.group;
			const frameCount = currentGroup?.frames ?? item.frames;
			const groupDurations = currentGroup?.frameDurations;

			let durations: number[];
			if (groupDurations && groupDurations.length > 0) {
				durations = groupDurations.map((d) => d.minimum);
			} else if (item.frameDurations && item.frameDurations.length > 0) {
				durations = item.frameDurations.map((d) => d.minimum);
			} else {
				const defaultDuration = itemRenderConfig?.defaultFrameDuration ?? 500;
				durations = new Array(frameCount).fill(defaultDuration);
			}

			const isGroupWalking = currentGroup?.type === 1;
			if (isGroupWalking && frameCount > 2) {
				const walkingDuration = Math.floor(1000 / frameCount);
				durations = durations.map(() => walkingDuration);
			}

			durations = durations.map((d) => Math.max(d, 50));

			const loopCount = currentGroup?.loopCount ?? item.loopCount ?? 0;
			const rawStartFrame = currentGroup?.startFrame ?? item.startFrame ?? -1;

			const isIdle = currentGroup?.type !== 1;
			const skipFirstFrame = !!itemRenderConfig?.skipFirstIdleFrame && !item.animateAlways && isIdle;

			const startFrame = rawStartFrame > -1 ? rawStartFrame : Math.floor(Math.random() * frameCount);
			const initialFrame = skipFirstFrame && startFrame === 0 ? 1 % frameCount : startFrame;

			animationState.current.frame = initialFrame;
			animationState.current.frames = frameCount;
			animationState.current.durations = durations;
			animationState.current.loopCount = loopCount;
			animationState.current.direction = AnimationDirection.FORWARD;
			animationState.current.currentLoop = 0;
			animationState.current.isComplete = false;
			animationState.current.skipFirstFrame = skipFirstFrame;
			animationState.current.timeRemaining = durations[initialFrame] || 200;
			animationState.current.lastTime = 0;
			setCurrentFrame(initialFrame);

			requestRef.current = requestAnimationFrame(animate);
		} else {
			animationState.current.frames = 0;
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		}

		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [isPlaying, item, hasAnimation, animationInfo]);

	const handlePlayPause = () => {
		if (!isPlaying) {
			setIsPlaying(true);
		} else {
			setIsPlaying(false);
			if (itemRenderConfig?.resetFrameOnPause) {
				setCurrentFrame(0);
			}
		}
	};

	if (!data || !item) {
		return (
			<div className="w-full h-[150px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Visualization</h2>
				</div>
				<div className="flex-1 flex items-center justify-center p-4 min-h-0">
					<div className="text-center text-muted-foreground">
						<FileQuestion className="h-16 w-16 mx-auto mb-3 opacity-50" />
						<p className="text-xs">No item selected</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-[150px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Visualization</h2>
			</div>
			<div className="flex-1 min-h-0 p-2 relative">
				<CheckerBoard className="w-full h-full border border-border/50 rounded-lg flex items-center justify-center overflow-hidden">
					{displayThing?.spriteIndex && displayThing.spriteIndex.length > 0 ? (
						<SpriteCanvas
							scale={1}
							showEmpty
							layer={0}
							patternY={0}
							patternZ={0}
							frame={currentFrame}
							thing={displayThing}
							renderMode="preview"
							width={displayThing.width}
							height={displayThing.height}
							patternX={
								itemRenderConfig?.listPatternXClamp ? Math.min(itemRenderConfig.listPatternXClamp, displayThing.patternX - 1) : 0
							}
							outfitData={
								itemRenderConfig?.layerCompositing && displayThing.layers > 1
									? {
											head: 0,
											body: 0,
											legs: 0,
											feet: 0,
											addons: displayThing.patternY > 1 ? Array(displayThing.patternY - 1).fill(false) : [false, false]
										}
									: undefined
							}
						/>
					) : (
						<SpriteCanvas
							scale={1}
							showEmpty
							renderMode="preview"
							thing={displayThing!}
							width={displayThing?.width || 1}
							height={displayThing?.height || 1}
						/>
					)}
				</CheckerBoard>

				{/* Play/Pause button overlay for animated items */}
				{hasAnimation && (
					<Button
						size="icon"
						variant="secondary"
						onClick={handlePlayPause}
						title={isPlaying ? 'Pause animation' : 'Play animation'}
						className="absolute bottom-3 right-3 h-6 w-6 opacity-70 hover:opacity-100 transition-opacity"
					>
						{isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
					</Button>
				)}
			</div>
		</div>
	);
};
