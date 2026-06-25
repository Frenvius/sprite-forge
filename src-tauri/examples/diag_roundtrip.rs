use sprite_forge_lib::dat_reader::DatReader;
use sprite_forge_lib::dat_writer::write_dat_file;

fn main() {
	let args: Vec<String> = std::env::args().collect();
	if args.len() < 3 {
		eprintln!("usage: diag_roundtrip <path-to.dat> <version> [delete_item_id]");
		std::process::exit(2);
	}
	let path = &args[1];
	let version: u32 = args[2].parse().expect("version number");

	let mut reader = DatReader::open(path).expect("open");
	reader.set_version(version);
	reader.apply_overrides(Some(true), Some(true), Some(true));
	let (signature, mut items, outfits, effects, missiles) = reader.read_dat().expect("initial parse");

	let items_min: u16 = 100;
	let items_max: u16 = items_min + items.len() as u16 - 1;
	let outfits_max: u16 = outfits.len() as u16;
	let effects_max: u16 = effects.len() as u16;
	let missiles_max: u16 = missiles.len() as u16;

	let del_id: u32 = args
		.get(3)
		.map(|s| s.parse().unwrap())
		.unwrap_or_else(|| items[items.len() / 2].id);

	let before = items.len();
	items.retain(|t| t.id != del_id);
	println!(
		"deleting item id {} (items {} -> {}); max id stays {} so it becomes a gap",
		del_id, before, items.len(), items_max
	);

	let out_path = format!("{}.roundtrip.dat", path);
	write_dat_file(
		&out_path,
		signature,
		version,
		true,
		true,
		true,
		items_min,
		items_max,
		1,
		outfits_max,
		1,
		effects_max,
		1,
		missiles_max,
		items,
		outfits,
		effects,
		missiles,
	)
	.expect("write_dat_file");

	let mut r2 = DatReader::open(&out_path).expect("reopen");
	r2.set_version(version);
	r2.apply_overrides(Some(true), Some(true), Some(true));
	match r2.read_dat() {
		Ok((_s, i, o, e, m)) => println!(
			"RE-PARSE OK: items={} outfits={} effects={} missiles={} (gap at {} survived)",
			i.len(),
			o.len(),
			e.len(),
			m.len(),
			del_id
		),
		Err(err) => {
			println!("RE-PARSE FAILED: {}", err);
			std::process::exit(1);
		}
	}
}
