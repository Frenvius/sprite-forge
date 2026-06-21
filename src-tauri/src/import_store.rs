use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::pack::PackData;

pub struct ImportRecord {
	pub category: u8,
	pub source_id: u32,
	pub name: String,
	pub thumb_w: u16,
	pub thumb_h: u16,
	pub frames: u8,
	pub sprite_count: u32,
	pub content_hash: u64,
	pub locator: u32,
}

pub enum ImportSrc {
	None,
	Obd(Vec<String>),
	Sfp(Box<PackData>),
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Status {
	Idle,
	Parsing,
	Done,
}

impl Status {
	pub fn code(self) -> u8 {
		match self {
			Status::Idle => 0,
			Status::Parsing => 1,
			Status::Done => 2,
		}
	}
}

pub struct ImportStore {
	pub status: Status,
	pub job: u64,
	pub total: usize,
	pub done: usize,
	pub started: Option<Instant>,
	pub records: Vec<ImportRecord>,
	pub src: ImportSrc,
	pub transparent: bool,
	hash_count: HashMap<u64, u32>,
}

impl ImportStore {
	pub fn new() -> Self {
		ImportStore {
			status: Status::Idle,
			job: 0,
			total: 0,
			done: 0,
			started: None,
			records: Vec::new(),
			src: ImportSrc::None,
			transparent: false,
			hash_count: HashMap::new(),
		}
	}

	pub fn begin(&mut self, total: usize, src: ImportSrc, transparent: bool) -> u64 {
		self.job = self.job.wrapping_add(1);
		self.status = Status::Parsing;
		self.total = total;
		self.done = 0;
		self.records = Vec::with_capacity(total.min(1_000_000));
		self.hash_count = HashMap::new();
		self.started = Some(Instant::now());
		self.src = src;
		self.transparent = transparent;
		self.job
	}

	pub fn begin_parsing(&mut self) -> u64 {
		self.job = self.job.wrapping_add(1);
		self.status = Status::Parsing;
		self.total = 0;
		self.done = 0;
		self.records = Vec::new();
		self.hash_count = HashMap::new();
		self.started = Some(Instant::now());
		self.src = ImportSrc::None;
		self.transparent = false;
		self.job
	}

	pub fn install(&mut self, job: u64, recs: Vec<ImportRecord>, src: ImportSrc, transparent: bool) -> bool {
		if job != self.job {
			return false;
		}
		self.total = recs.len();
		self.done = recs.len();
		self.hash_count = HashMap::new();
		for r in &recs {
			*self.hash_count.entry(r.content_hash).or_insert(0) += 1;
		}
		self.records = recs;
		self.src = src;
		self.transparent = transparent;
		self.status = Status::Done;
		true
	}

	pub fn extend(&mut self, job: u64, processed: usize, recs: Vec<ImportRecord>) -> bool {
		if job != self.job {
			return false;
		}
		self.done += processed;
		for rec in recs {
			*self.hash_count.entry(rec.content_hash).or_insert(0) += 1;
			self.records.push(rec);
		}
		true
	}

	pub fn finish(&mut self, job: u64) {
		if job == self.job {
			self.status = Status::Done;
		}
	}

	pub fn is_dup(&self, hash: u64) -> bool {
		self.hash_count.get(&hash).copied().unwrap_or(0) > 1
	}

	pub fn duplicate_count(&self) -> usize {
		self.records.iter().filter(|r| self.is_dup(r.content_hash)).count()
	}

	pub fn elapsed_ms(&self) -> u64 {
		self.started.map(|s| s.elapsed().as_millis() as u64).unwrap_or(0)
	}

	pub fn clear(&mut self) {
		self.job = self.job.wrapping_add(1);
		self.status = Status::Idle;
		self.total = 0;
		self.done = 0;
		self.records = Vec::new();
		self.hash_count = HashMap::new();
		self.started = None;
		self.src = ImportSrc::None;
	}
}

pub type ImportStoreState = Arc<Mutex<ImportStore>>;

pub fn thing_pixel_hash<'a>(ids: impl Iterator<Item = u32>, get: impl Fn(u32) -> Option<&'a [u8]>) -> u64 {
	let mut h: u64 = 0xcbf2_9ce4_8422_2325;
	for id in ids {
		match get(id) {
			Some(rgba) => {
				for &b in rgba {
					h ^= b as u64;
					h = h.wrapping_mul(0x0000_0100_0000_01b3);
				}
			}
			None => {
				h ^= 0xff;
				h = h.wrapping_mul(0x0000_0100_0000_01b3);
			}
		}
	}
	h
}
