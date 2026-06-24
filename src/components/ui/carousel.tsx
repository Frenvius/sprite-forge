import * as React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	setApi?: (api: CarouselApi) => void;
	orientation?: 'vertical' | 'horizontal';
};

type CarouselContextProps = {
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
	api: ReturnType<typeof useEmblaCarousel>[1];
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
} & CarouselProps;

const CarouselContext = React.createContext<null | CarouselContextProps>(null);

function useCarousel() {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error('useCarousel must be used within a <Carousel />');
	}

	return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
	({ opts, setApi, plugins, children, className, orientation = 'horizontal', ...props }, ref) => {
		const [carouselRef, api] = useEmblaCarousel(
			{
				...opts,
				axis: orientation === 'horizontal' ? 'x' : 'y'
			},
			plugins
		);
		const [canScrollPrev, setCanScrollPrev] = React.useState(false);
		const [canScrollNext, setCanScrollNext] = React.useState(false);

		const onSelect = React.useCallback((api: CarouselApi) => {
			if (!api) {
				return;
			}

			setCanScrollPrev(api.canScrollPrev());
			setCanScrollNext(api.canScrollNext());
		}, []);

		const scrollPrev = React.useCallback(() => {
			api?.scrollPrev();
		}, [api]);

		const scrollNext = React.useCallback(() => {
			api?.scrollNext();
		}, [api]);

		const handleKeyDown = React.useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				if (event.key === 'ArrowLeft') {
					event.preventDefault();
					scrollPrev();
				} else if (event.key === 'ArrowRight') {
					event.preventDefault();
					scrollNext();
				}
			},
			[scrollPrev, scrollNext]
		);

		React.useEffect(() => {
			if (!api || !setApi) {
				return;
			}

			setApi(api);
		}, [api, setApi]);

		React.useEffect(() => {
			if (!api) {
				return;
			}

			onSelect(api);
			api.on('reInit', onSelect);
			api.on('select', onSelect);

			return () => {
				api?.off('select', onSelect);
			};
		}, [api, onSelect]);

		return (
			<CarouselContext.Provider
				value={{
					opts,
					api: api,
					scrollPrev,
					scrollNext,
					carouselRef,
					canScrollPrev,
					canScrollNext,
					orientation: orientation || (opts?.axis === 'y' ? 'vertical' : 'horizontal')
				}}
			>
				<div
					ref={ref}
					role="region"
					aria-roledescription="carousel"
					onKeyDownCapture={handleKeyDown}
					className={cn('relative', className)}
					{...props}
				>
					{children}
				</div>
			</CarouselContext.Provider>
		);
	}
);
Carousel.displayName = 'Carousel';

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div ref={carouselRef} className="overflow-hidden">
			<div ref={ref} className={cn('flex', orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col', className)} {...props} />
		</div>
	);
});
CarouselContent.displayName = 'CarouselContent';

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
	const { orientation } = useCarousel();

	return (
		<div
			ref={ref}
			role="group"
			aria-roledescription="slide"
			className={cn('min-w-0 shrink-0 grow-0 basis-full', orientation === 'horizontal' ? 'pl-4' : 'pt-4', className)}
			{...props}
		/>
	);
});
CarouselItem.displayName = 'CarouselItem';

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, size = 'icon', variant = 'outline', ...props }, ref) => {
		const { scrollPrev, orientation, canScrollPrev } = useCarousel();

		return (
			<Button
				ref={ref}
				size={size}
				variant={variant}
				onClick={scrollPrev}
				disabled={!canScrollPrev}
				className={cn(
					'absolute h-8 w-8 rounded-full',
					orientation === 'horizontal' ? '-left-12 top-1/2 -translate-y-1/2' : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
					className
				)}
				{...props}
			>
				<ArrowLeft className="h-4 w-4" />
				<span className="sr-only">Previous slide</span>
			</Button>
		);
	}
);
CarouselPrevious.displayName = 'CarouselPrevious';

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, size = 'icon', variant = 'outline', ...props }, ref) => {
		const { scrollNext, orientation, canScrollNext } = useCarousel();

		return (
			<Button
				ref={ref}
				size={size}
				variant={variant}
				onClick={scrollNext}
				disabled={!canScrollNext}
				className={cn(
					'absolute h-8 w-8 rounded-full',
					orientation === 'horizontal' ? '-right-12 top-1/2 -translate-y-1/2' : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
					className
				)}
				{...props}
			>
				<ArrowRight className="h-4 w-4" />
				<span className="sr-only">Next slide</span>
			</Button>
		);
	}
);
CarouselNext.displayName = 'CarouselNext';

export { Carousel, CarouselItem, CarouselNext, CarouselContent, type CarouselApi, CarouselPrevious };
