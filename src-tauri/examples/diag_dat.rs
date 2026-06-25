use sprite_forge_lib::dat_reader::DatReader;

fn main() {
	let args: Vec<String> = std::env::args().collect();
	if args.len() < 3 {
		eprintln!("usage: diag_dat <path-to.dat> <version> [extended] [frameDurations] [frameGroups]");
		eprintln!("  flags default to version-based; pass true/false to override");
		std::process::exit(2);
	}

	let path = &args[1];
	let version: u32 = args[2].parse().expect("version must be a number, e.g. 1098");
	let parse_flag = |i: usize| args.get(i).map(|s| s == "true");
	let extended = parse_flag(3);
	let frame_durations = parse_flag(4);
	let frame_groups = parse_flag(5);

	let mut reader = match DatReader::open(path) {
		Ok(r) => r,
		Err(e) => {
			eprintln!("open failed: {}", e);
			std::process::exit(1);
		}
	};
	reader.set_version(version);
	reader.apply_overrides(extended, frame_durations, frame_groups);

	println!(
		"parsing {} as v{} (extended={:?} frameDurations={:?} frameGroups={:?})",
		path, version, extended, frame_durations, frame_groups
	);

	match reader.read_dat() {
		Ok((sig, items, outfits, effects, missiles)) => {
			println!(
				"OK signature=0x{:08x} items={} outfits={} effects={} missiles={}",
				sig,
				items.len(),
				outfits.len(),
				effects.len(),
				missiles.len()
			);
		}
		Err(e) => {
			println!("PARSE FAILED: {}", e);
			std::process::exit(1);
		}
	}
}
