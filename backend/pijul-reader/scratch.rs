use libpijul::{changestore::filesystem::FileSystem, pristine::{sanakirja::Pristine, ArcTxn, ChannelTxnT, TxnT}, TxnTExt};
use std::path::Path;

fn main() {
    let repo_path = Path::new("/home/abhay/tmptasks/pijultest/clone1");
    let pristine_path = repo_path.join(".pijul").join("pristine").join("db");
    let pristine = Pristine::new(&pristine_path).unwrap();
    let txn = pristine.txn_begin().unwrap();
    let channel = txn.load_channel("main").unwrap().unwrap();
    
    let channel_guard = channel.read();
    
    // Reverse iterator from the end of the log?
    // In libpijul 1.0, txn.log returns an iterator.
    if let Some(log) = txn.log(&*channel_guard, 0).unwrap().iter().rev().next() {
        println!("{:?}", log);
    }
}
